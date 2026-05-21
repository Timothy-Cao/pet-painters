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
// Tier label (legacy WR-based)
// ---------------------------------------------------------------------------

function tierOf(wr: number): string {
  if (wr >= 0.65) return 'S';
  if (wr >= 0.55) return 'A';
  if (wr >= 0.45) return 'B';
  if (wr >= 0.35) return 'C';
  return 'D';
}

// ---------------------------------------------------------------------------
// Meta-tier label (appearance-rate based)
// ---------------------------------------------------------------------------

function metaTierOf(appearance: number): string {
  if (appearance >= 0.30) return 'Core';
  if (appearance >= 0.10) return 'Niche';
  if (appearance > 0) return 'Fringe';
  return 'Dead';
}

// ---------------------------------------------------------------------------
// Counter-comp pass
// ---------------------------------------------------------------------------

interface CounterPassResult {
  /** compIdx -> avg WR when facing the top-20 comps */
  counterScore: Map<number, number>;
}

/**
 * For each of the 20 top comps T, run T vs all 455 comps as opponent
 * (10 samples each, 5 each side). Returns counter scores per comp index.
 */
function runCounterPass(
  comps: CompDef[],
  top20Indices: number[],
): CounterPassResult {
  const totalMatches = top20Indices.length * comps.length * TEAM_SAMPLES;
  console.log(`[counter] ${top20Indices.length} top comps × ${comps.length} opponents × ${TEAM_SAMPLES} samples = ${totalMatches} matches...`);

  // For each comp C, accumulate its WR when playing against a top-20 comp
  // "C's WR vs T" means: C is the opponent of T, so we want C's perspective
  // i.e. how well C does against T. We track: for each C, sum of (C's WR vs each T), count.
  const counterWr = new Map<number, { wrSum: number; count: number }>();
  for (let ci = 0; ci < comps.length; ci++) {
    counterWr.set(ci, { wrSum: 0, count: 0 });
  }

  let matchSeed = 9_000_000; // distinct seed range from team sweep
  let progress = 0;

  for (const tIdx of top20Indices) {
    const topComp = comps[tIdx];
    for (let ci = 0; ci < comps.length; ci++) {
      if (ci === tIdx) {
        progress++;
        continue; // skip mirror
      }
      const opp = comps[ci];
      const agg = emptyAgg();

      const halfA = Math.floor(TEAM_SAMPLES / 2);
      const halfB = TEAM_SAMPLES - halfA;

      // Side-A samples: topComp=A, opp=B — opp's perspective is B
      for (let s = 0; s < halfA; s++) {
        const raw = runHeadlessMatch(
          { petIds: topComp },
          { petIds: opp },
          { energyBudget: ENERGY_BUDGET, winThreshold: WIN_THRESHOLD, maxSeconds: MAX_SECONDS, seed: matchSeed++ },
        );
        // Reframe to opp's (C's) perspective: A=topComp, B=opp
        const reframed = {
          ...raw,
          winner: raw.winner === 'A' ? 'B' as const : raw.winner === 'B' ? 'A' as const : 'draw' as const,
          scoreA: raw.scoreB,
          scoreB: raw.scoreA,
          petsDeployedA: raw.petsDeployedB,
          petsDeployedB: raw.petsDeployedA,
        };
        add(agg, reframed);
      }

      // Side-B samples: opp=A, topComp=B — opp's perspective is A
      for (let s = 0; s < halfB; s++) {
        const raw = runHeadlessMatch(
          { petIds: opp },
          { petIds: topComp },
          { energyBudget: ENERGY_BUDGET, winThreshold: WIN_THRESHOLD, maxSeconds: MAX_SECONDS, seed: matchSeed++ },
        );
        add(agg, raw); // opp is already A, no reframe needed
      }

      const wr = winRate(finalize(agg));
      const entry = counterWr.get(ci)!;
      entry.wrSum += wr;
      entry.count++;
      progress++;
    }

    const done = top20Indices.indexOf(tIdx) + 1;
    process.stdout.write(`  top-comp ${done}/${top20Indices.length}\r`);
  }
  process.stdout.write('\n');

  // Compute average counter WR per comp
  const counterScore = new Map<number, number>();
  for (const [ci, entry] of counterWr) {
    counterScore.set(ci, entry.count > 0 ? entry.wrSum / entry.count : 0.5);
  }

  return { counterScore };
}

// ---------------------------------------------------------------------------
// Meta pool + appearance rate
// ---------------------------------------------------------------------------

interface MetaResult {
  top20Indices: number[];
  counter20Indices: number[];
  metaPoolIndices: number[];
  /** pet id -> appearance rate (count of meta comps containing pet / meta pool size) */
  appearanceRate: Map<string, number>;
}

function computeMetaPool(
  comps: CompDef[],
  results: CompResult[],
): MetaResult {
  // Step 1: top 20 comps by WR
  const sorted = [...results].sort((a, b) => winRate(b.agg) - winRate(a.agg));
  const top20Indices = sorted.slice(0, 20).map(cr => cr.compIdx);

  // Step 2: counter pass
  const { counterScore } = runCounterPass(comps, top20Indices);

  // Step 3: top 20 counter comps by avg counter-WR (excluding top-20 members for clarity, but spec says union after)
  const counterSorted = [...counterScore.entries()]
    .sort((a, b) => b[1] - a[1]);
  const counter20Indices = counterSorted.slice(0, 20).map(([ci]) => ci);

  // Step 4: meta pool = union
  const metaPoolSet = new Set([...top20Indices, ...counter20Indices]);
  const metaPoolIndices = [...metaPoolSet];

  // Step 5: per-pet appearance rate
  const appearanceCount = new Map<string, number>();
  for (const p of ALL_PETS) appearanceCount.set(p.id, 0);

  for (const ci of metaPoolIndices) {
    const uniqueInComp = new Set(comps[ci]);
    for (const petId of uniqueInComp) {
      appearanceCount.set(petId, (appearanceCount.get(petId) ?? 0) + 1);
    }
  }

  const poolSize = metaPoolIndices.length;
  const appearanceRate = new Map<string, number>();
  for (const [petId, count] of appearanceCount) {
    appearanceRate.set(petId, poolSize > 0 ? count / poolSize : 0);
  }

  return { top20Indices, counter20Indices, metaPoolIndices, appearanceRate };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function writeReport(
  comps: CompDef[],
  results: CompResult[],
  teamWrs: Map<string, PetTeamScore>,
  synergies: PairSynergy[],
  meta: MetaResult,
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

  // ---------------------------------------------------------------------------
  // NEW: Meta-comp sections
  // ---------------------------------------------------------------------------

  // Meta tier list
  lines.push(`## Meta tier list — pet by meta appearance rate`);
  lines.push('');
  lines.push(`*Meta appearance = count of comps in the meta pool (top-20 WR ∪ top-20 counter) that contain the pet, divided by meta pool size (${meta.metaPoolIndices.length} comps).*`);
  lines.push('');
  lines.push(`| Meta Tier | Pet | Appearance | Comps in pool |`);
  lines.push(`|---|---|---|---|`);
  const sortedByAppearance = ALL_PETS.map(p => ({
    pet: p,
    rate: meta.appearanceRate.get(p.id) ?? 0,
    count: meta.metaPoolIndices.filter(ci => new Set(comps[ci]).has(p.id)).length,
  })).sort((a, b) => b.rate - a.rate);
  for (const { pet, rate, count } of sortedByAppearance) {
    lines.push(`| ${metaTierOf(rate)} | ${pet.emoji} ${pet.displayName} | ${(rate * 100).toFixed(1)}% | ${count} |`);
  }
  lines.push('');

  // The meta pool comps
  lines.push(`## The ${meta.metaPoolIndices.length} meta pool comps`);
  lines.push('');
  lines.push(`*Source: T = top-WR comp, C = top-counter comp, TC = both.*`);
  lines.push('');
  lines.push(`| Comp | WR | Counter Score | Source |`);
  lines.push(`|---|---|---|---|`);
  const top20Set = new Set(meta.top20Indices);
  const counter20Set = new Set(meta.counter20Indices);
  // Sort meta pool: top-WR first, then counter-only
  const sortedMeta = [...meta.metaPoolIndices].sort((a, b) => {
    const aWr = winRate(results[a].agg);
    const bWr = winRate(results[b].agg);
    return bWr - aWr;
  });
  for (const ci of sortedMeta) {
    const cr = results[ci];
    const emojis = cr.comp.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const ids = cr.comp.join('+');
    const wr = winRate(cr.agg);
    // Counter score: need to look up from meta computation; pass it through
    const inTop = top20Set.has(ci);
    const inCounter = counter20Set.has(ci);
    const source = inTop && inCounter ? 'TC' : inTop ? 'T' : 'C';
    lines.push(`| ${emojis} (${ids}) | ${(wr * 100).toFixed(1)}% | — | ${source} |`);
  }
  lines.push('');

  // Dead pets
  const deadPets = sortedByAppearance.filter(({ rate }) => rate === 0);
  lines.push(`## Dead pets (0% meta appearance)`);
  lines.push('');
  if (deadPets.length === 0) {
    lines.push('*No dead pets — all pets appear in at least one meta comp!*');
  } else {
    lines.push(`*These pets don't appear in any of the ${meta.metaPoolIndices.length} meta comps. They are the primary balance targets.*`);
    lines.push('');
    lines.push(`| Pet | Cost | Solo Team WR | Best Comp WR | Diagnosis |`);
    lines.push(`|---|---|---|---|---|`);
    for (const { pet } of deadPets) {
      const teamScore = teamWrs.get(pet.id)!;
      // Find best comp WR for this pet
      const petComps = results.filter(cr => cr.comp.includes(pet.id));
      const bestCompWr = petComps.length > 0 ? Math.max(...petComps.map(cr => winRate(cr.agg))) : 0;
      const def = ALL_PETS.find(d => d.id === pet.id)!;
      const diagnosis = bestCompWr < 0.45
        ? `Low peak WR (${(bestCompWr * 100).toFixed(0)}%) — fundamentally undertuned`
        : `Decent peak (${(bestCompWr * 100).toFixed(0)}%) but inconsistent — needs reliability buff`;
      lines.push(`| ${pet.emoji} ${pet.displayName} | ${def.cost} | ${(teamScore.teamWr * 100).toFixed(1)}% | ${(bestCompWr * 100).toFixed(1)}% | ${diagnosis} |`);
    }
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
      metaPool: meta.metaPoolIndices.map(ci => ({
        comp: comps[ci],
        wr: winRate(results[ci].agg),
        isTop20: meta.top20Indices.includes(ci),
        isCounter20: meta.counter20Indices.includes(ci),
      })),
      metaAppearanceRates: Object.fromEntries([...meta.appearanceRate.entries()]),
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

  console.log('\nRunning meta-comp counter pass...');
  const meta = computeMetaPool(comps, results);
  console.log(`Meta pool: ${meta.metaPoolIndices.length} comps (${meta.top20Indices.length} top-WR + ${meta.counter20Indices.length} top-counter, ${meta.metaPoolIndices.length - meta.top20Indices.length - meta.counter20Indices.length + meta.metaPoolIndices.filter(ci => meta.top20Indices.includes(ci) && meta.counter20Indices.includes(ci)).length} overlap).`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Total wall time: ${elapsed}s`);

  const { md, json } = writeReport(comps, results, teamWrs, synergies, meta);

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
