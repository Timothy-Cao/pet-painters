import { ALL_PETS } from '../../src/sim/pets';
import { runHeadlessMatch, type Comp, type MatchResult } from './sim';
import { WIN_PAINT_THRESHOLD } from '../../src/config/balance';
import { BOARD_SIZE, HOME_ROWS } from '../../src/config/constants';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ENERGY_BUDGET = 20;
const MAX_SECONDS = 30;

// Parse --threshold=N from CLI args. Falls back to game default.
function parseThreshold(): number {
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--threshold=(\d+)$/);
    if (m) return parseInt(m[1], 10);
  }
  return WIN_PAINT_THRESHOLD;
}
const WIN_THRESHOLD = parseThreshold();
const WIN_PCT = Math.round((WIN_THRESHOLD / (BOARD_SIZE * BOARD_SIZE)) * 100);

// Team-comp sweep settings.
// 455 comps total × M opponents × S samples each side = total matches.
const TEAM_OPPONENTS = 25;    // random opponents per comp
const TEAM_SAMPLES = 10;      // total matches per (comp, opponent) pair (5 each side)

interface Aggregate {
  winsA: number;
  winsB: number;
  draws: number;
  avgScoreA: number;
  avgScoreB: number;
  avgPetsDeployedA: number;
  avgPetsDeployedB: number;
  samples: number;
}

function emptyAgg(): Aggregate {
  return { winsA: 0, winsB: 0, draws: 0, avgScoreA: 0, avgScoreB: 0, avgPetsDeployedA: 0, avgPetsDeployedB: 0, samples: 0 };
}

function add(agg: Aggregate, r: MatchResult): void {
  agg.samples++;
  if (r.winner === 'A') agg.winsA++;
  else if (r.winner === 'B') agg.winsB++;
  else agg.draws++;
  agg.avgScoreA += r.scoreA;
  agg.avgScoreB += r.scoreB;
  agg.avgPetsDeployedA += r.petsDeployedA;
  agg.avgPetsDeployedB += r.petsDeployedB;
}

function finalize(agg: Aggregate): Aggregate {
  if (agg.samples === 0) return agg;
  return {
    ...agg,
    avgScoreA: agg.avgScoreA / agg.samples,
    avgScoreB: agg.avgScoreB / agg.samples,
    avgPetsDeployedA: agg.avgPetsDeployedA / agg.samples,
    avgPetsDeployedB: agg.avgPetsDeployedB / agg.samples,
  };
}

function winRate(agg: Aggregate): number {
  if (agg.samples === 0) return 0.5;
  return (agg.winsA + agg.draws * 0.5) / agg.samples;
}

// Seeded RNG for opponent selection (independent of sim's RNG)
let pickSeed = 0xC0FFEE;
function pickRng(): number {
  pickSeed = (pickSeed * 1103515245 + 12345) >>> 0;
  return pickSeed / 4294967296;
}
function pickIdx(n: number): number { return Math.floor(pickRng() * n); }

// ---------------------------------------------------------------------------
// Comp enumeration: 455 unique 3-pet comps
// ---------------------------------------------------------------------------

/** A canonical comp: array of petIds (order matters for cycling). */
type CompDef = string[];

/**
 * Enumerate all 455 unique 3-pet comps:
 *   13  "3-of-one"   [X, X, X]
 *   156 "2:1"        [X, X, Y] for all (X, Y) ordered pairs where X != Y
 *   286 "1:1:1"      {X, Y, Z} all-distinct unordered triples (canonical alphabetical order)
 */
function enumerateComps(): CompDef[] {
  const comps: CompDef[] = [];
  const ids = ALL_PETS.map(p => p.id);

  // 3-of-one
  for (const x of ids) {
    comps.push([x, x, x]);
  }

  // 2:1 — ordered pair (X, Y) where X != Y. Array = [X, X, Y]
  for (const x of ids) {
    for (const y of ids) {
      if (y === x) continue;
      comps.push([x, x, y]);
    }
  }

  // 1:1:1 — unordered triple of distinct pets.
  // Canonical: sort alphabetically to deduplicate.
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (let k = j + 1; k < ids.length; k++) {
        // Sort alphabetically for canonical form.
        const triple = [ids[i], ids[j], ids[k]].sort();
        comps.push(triple);
      }
    }
  }

  return comps;
}

// ---------------------------------------------------------------------------
// Team sweep
// ---------------------------------------------------------------------------

interface CompResult {
  comp: CompDef;
  compIdx: number;
  agg: Aggregate;
}

function runTeamSweep(comps: CompDef[]): CompResult[] {
  const totalMatchups = comps.length * TEAM_OPPONENTS;
  const totalMatches = totalMatchups * TEAM_SAMPLES;
  console.log(`[team] ${comps.length} comps × ${TEAM_OPPONENTS} opponents × ${TEAM_SAMPLES} samples = ${totalMatches} matches...`);

  const results: CompResult[] = comps.map((comp, idx) => ({ comp, compIdx: idx, agg: emptyAgg() }));
  let matchSeed = 0;

  for (let ci = 0; ci < comps.length; ci++) {
    const comp = comps[ci];
    for (let oi = 0; oi < TEAM_OPPONENTS; oi++) {
      // Pick a random opponent comp (different index)
      let oppIdx: number;
      do { oppIdx = pickIdx(comps.length); } while (oppIdx === ci);
      const opp = comps[oppIdx];

      const halfA = Math.floor(TEAM_SAMPLES / 2);
      const halfB = TEAM_SAMPLES - halfA;

      // Side-A samples: comp = side A
      for (let s = 0; s < halfA; s++) {
        const r = runHeadlessMatch(
          { petIds: comp },
          { petIds: opp },
          { energyBudget: ENERGY_BUDGET, winThreshold: WIN_THRESHOLD, maxSeconds: MAX_SECONDS, seed: matchSeed++ },
        );
        add(results[ci].agg, r);
      }

      // Side-B samples: comp = side B (reframe so result is comp's perspective)
      for (let s = 0; s < halfB; s++) {
        const raw = runHeadlessMatch(
          { petIds: opp },
          { petIds: comp },
          { energyBudget: ENERGY_BUDGET, winThreshold: WIN_THRESHOLD, maxSeconds: MAX_SECONDS, seed: matchSeed++ },
        );
        const reframed = {
          ...raw,
          winner: raw.winner === 'A' ? 'B' as const : raw.winner === 'B' ? 'A' as const : 'draw' as const,
          scoreA: raw.scoreB,
          scoreB: raw.scoreA,
          petsDeployedA: raw.petsDeployedB,
          petsDeployedB: raw.petsDeployedA,
        };
        add(results[ci].agg, reframed);
      }
    }
    results[ci].agg = finalize(results[ci].agg);

    // Progress log every 50 comps
    if ((ci + 1) % 50 === 0 || ci + 1 === comps.length) {
      process.stdout.write(`  comp ${ci + 1}/${comps.length}\r`);
    }
  }
  process.stdout.write('\n');
  return results;
}

// ---------------------------------------------------------------------------
// Per-pet team WR
// ---------------------------------------------------------------------------

interface PetTeamScore {
  petId: string;
  teamWr: number;
  samples: number;
  compCount: number;
}

function computeTeamWr(comps: CompDef[], results: CompResult[]): Map<string, PetTeamScore> {
  const scores = new Map<string, PetTeamScore>();
  for (const p of ALL_PETS) {
    scores.set(p.id, { petId: p.id, teamWr: 0, samples: 0, compCount: 0 });
  }

  for (const cr of results) {
    const wr = winRate(cr.agg);
    const inComp = new Set(cr.comp);
    for (const petId of inComp) {
      const s = scores.get(petId)!;
      s.teamWr += wr * cr.agg.samples;
      s.samples += cr.agg.samples;
      s.compCount++;
    }
  }

  for (const s of scores.values()) {
    s.teamWr = s.samples > 0 ? s.teamWr / s.samples : 0.5;
  }
  return scores;
}

// ---------------------------------------------------------------------------
// Synergy heatmap (bonus)
// ---------------------------------------------------------------------------

interface PairSynergy {
  petA: string;
  petB: string;
  avgWr: number;
  delta: number; // vs petA's team WR baseline
  samples: number;
}

function computeSynergies(comps: CompDef[], results: CompResult[], teamWrs: Map<string, PetTeamScore>): PairSynergy[] {
  // For each ordered pair (A, B): comps of type [A, A, B] only.
  const pairWrs = new Map<string, { wr: number; samples: number }>();
  for (const cr of results) {
    // Only 2:1 comps where the 2-slot pet is the first distinct id repeated
    if (cr.comp.length !== 3) continue;
    const [x, y, z] = cr.comp;
    if (x === y && y !== z) {
      // [X, X, Z] form
      const key = `${x}:${z}`;
      if (!pairWrs.has(key)) pairWrs.set(key, { wr: 0, samples: 0 });
      const entry = pairWrs.get(key)!;
      const wr = winRate(cr.agg);
      entry.wr += wr * cr.agg.samples;
      entry.samples += cr.agg.samples;
    }
  }
  const synergies: PairSynergy[] = [];
  for (const [key, val] of pairWrs) {
    const [petA, petB] = key.split(':');
    const avgWr = val.samples > 0 ? val.wr / val.samples : 0.5;
    const baseline = teamWrs.get(petA)?.teamWr ?? 0.5;
    synergies.push({ petA, petB, avgWr, delta: avgWr - baseline, samples: val.samples });
  }
  synergies.sort((a, b) => b.delta - a.delta);
  return synergies;
}

// ---------------------------------------------------------------------------
// Tier label
// ---------------------------------------------------------------------------

function tierOf(wr: number): string {
  if (wr >= 0.65) return 'S';
  if (wr >= 0.55) return 'A';
  if (wr >= 0.45) return 'B';
  if (wr >= 0.35) return 'C';
  return 'D';
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function writeReport(
  comps: CompDef[],
  results: CompResult[],
  teamWrs: Map<string, PetTeamScore>,
  synergies: PairSynergy[],
): { json: string; md: string } {
  const sortedPets = [...teamWrs.values()].sort((a, b) => b.teamWr - a.teamWr);

  const lines: string[] = [];
  lines.push(`# Pet Painters — Balance Report (Team-Comp Methodology)`);
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Config:** energy budget ${ENERGY_BUDGET}, match cap ${MAX_SECONDS}s, win threshold ${WIN_THRESHOLD} tiles (${WIN_PCT}% of ${BOARD_SIZE}x${BOARD_SIZE} board).`);
  lines.push(`**Sweep:** ${comps.length} unique 3-pet comps × ${TEAM_OPPONENTS} random opponents × ${TEAM_SAMPLES} samples (half each side) = ${comps.length * TEAM_OPPONENTS * TEAM_SAMPLES} total matches.`);
  lines.push('');

  // Tier list
  lines.push(`## Tier list — pet by average team win rate`);
  lines.push('');
  lines.push(`*Team WR = average WR across all 3-pet comps containing this pet, weighted by match count.*`);
  lines.push('');
  lines.push(`| Tier | Pet | Team WR | Comps containing pet |`);
  lines.push(`|---|---|---|---|`);
  for (const s of sortedPets) {
    const def = ALL_PETS.find(d => d.id === s.petId)!;
    lines.push(`| ${tierOf(s.teamWr)} | ${def.emoji} ${def.displayName} | ${(s.teamWr * 100).toFixed(1)}% | ${s.compCount} |`);
  }
  lines.push('');

  // Top 20 comps
  const sortedComps = [...results].sort((a, b) => winRate(b.agg) - winRate(a.agg));
  lines.push(`## Top 20 comps`);
  lines.push('');
  lines.push(`| Comp | Win rate | Samples |`);
  lines.push(`|---|---|---|`);
  for (const cr of sortedComps.slice(0, 20)) {
    const emojis = cr.comp.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const ids = cr.comp.join('+');
    lines.push(`| ${emojis} (${ids}) | ${(winRate(cr.agg) * 100).toFixed(1)}% | ${cr.agg.samples} |`);
  }
  lines.push('');

  // Bottom 20 comps
  lines.push(`## Bottom 20 comps`);
  lines.push('');
  lines.push(`| Comp | Win rate | Samples |`);
  lines.push(`|---|---|---|`);
  for (const cr of sortedComps.slice(-20).reverse()) {
    const emojis = cr.comp.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const ids = cr.comp.join('+');
    lines.push(`| ${emojis} (${ids}) | ${(winRate(cr.agg) * 100).toFixed(1)}% | ${cr.agg.samples} |`);
  }
  lines.push('');

  // Top synergies
  lines.push(`## Top 10 pair synergies`);
  lines.push('');
  lines.push(`*[A, A, B] comp WR vs pet A's solo team WR baseline — positive delta = pet A performs better with pet B as support.*`);
  lines.push('');
  lines.push(`| 2× | + 1× | [A,A,B] WR | A baseline | Delta |`);
  lines.push(`|---|---|---|---|---|`);
  for (const syn of synergies.slice(0, 10)) {
    const aDef = ALL_PETS.find(d => d.id === syn.petA)!;
    const bDef = ALL_PETS.find(d => d.id === syn.petB)!;
    const sign = syn.delta >= 0 ? '+' : '';
    lines.push(`| ${aDef.emoji} ${aDef.displayName} | ${bDef.emoji} ${bDef.displayName} | ${(syn.avgWr * 100).toFixed(1)}% | ${((teamWrs.get(syn.petA)?.teamWr ?? 0.5) * 100).toFixed(1)}% | ${sign}${(syn.delta * 100).toFixed(1)}% |`);
  }
  lines.push('');

  // Methodology
  lines.push(`## Methodology`);
  lines.push('');
  lines.push(`- **Comp types:** 13 three-of-one [X,X,X] + 156 two-one [X,X,Y] (ordered X,Y pairs) + 286 all-different [X,Y,Z] (alphabetical canonical) = 455 unique comps.`);
  lines.push(`- **Per comp:** plays ${TEAM_OPPONENTS} random opponents (different comp index), ${TEAM_SAMPLES} samples each (${Math.floor(TEAM_SAMPLES / 2)} as side A, ${TEAM_SAMPLES - Math.floor(TEAM_SAMPLES / 2)} as side B). Side-B samples reframed to comp's perspective.`);
  lines.push(`- **Team WR for pet P:** average WR across all comps containing P, weighted by sample count.`);
  lines.push(`- **Energy budget ${ENERGY_BUDGET}, match cap ${MAX_SECONDS}s**, greedy deployment, 20 ticks/s, 4 s stall-out.`);
  lines.push(`- Player A in rows 0..${HOME_ROWS - 1} (North), player B in rows ${BOARD_SIZE - HOME_ROWS}..${BOARD_SIZE - 1} (South). Bias cancelled by side-swapping.`);
  lines.push('');

  return {
    md: lines.join('\n'),
    json: JSON.stringify({
      config: { energyBudget: ENERGY_BUDGET, maxSeconds: MAX_SECONDS, winThreshold: WIN_THRESHOLD, winPct: WIN_PCT, teamOpponents: TEAM_OPPONENTS, teamSamples: TEAM_SAMPLES },
      teamWrs: Object.fromEntries([...teamWrs.entries()].map(([k, v]) => [k, v])),
      topComps: sortedComps.slice(0, 30).map(cr => ({ comp: cr.comp, wr: winRate(cr.agg), samples: cr.agg.samples })),
      bottomComps: sortedComps.slice(-30).map(cr => ({ comp: cr.comp, wr: winRate(cr.agg), samples: cr.agg.samples })),
      synergies: synergies.slice(0, 20),
    }, null, 2),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  const comps = enumerateComps();
  console.log(`Enumerated ${comps.length} comps (expected 455).`);

  const results = runTeamSweep(comps);
  const teamWrs = computeTeamWr(comps, results);
  const synergies = computeSynergies(comps, results, teamWrs);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Total wall time: ${elapsed}s`);

  const { md, json } = writeReport(comps, results, teamWrs, synergies);

  const dir = join(process.cwd(), 'docs', 'balance-reports');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  const mdPath = join(dir, `report-${stamp}-${WIN_PCT}pct.md`);
  const jsonPath = join(dir, `report-${stamp}-${WIN_PCT}pct.json`);
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, json);
  console.log(`\nWrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
