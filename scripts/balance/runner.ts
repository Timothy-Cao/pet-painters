import { ALL_PETS } from '../../src/sim/pets';
import { runHeadlessMatch, type Comp, type MatchResult } from './sim';
import { WIN_PAINT_THRESHOLD } from '../../src/config/balance';
import { BOARD_SIZE, HOME_ROWS } from '../../src/config/constants';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ENERGY_BUDGET = 20;
const MAX_SECONDS = 30;

const SOLO_SAMPLES = 100;
const PAIR_COMPS = 60;      // number of randomly drawn pair comps
const PAIR_SAMPLES = 30;    // matches per (compA, compB) pair
const PAIR_MATCHUPS = 80;   // total comp-vs-comp matchups to test
const TRIPLET_COMPS = 40;
const TRIPLET_SAMPLES = 20;
const TRIPLET_MATCHUPS = 50;

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

// Seeded RNG for matchup selection (independent of sim's RNG)
let pickSeed = 0xC0FFEE;
function pickRng(): number {
  pickSeed = (pickSeed * 1103515245 + 12345) >>> 0;
  return pickSeed / 4294967296;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(pickRng() * arr.length)]; }

interface SoloResult {
  petA: string;
  petB: string;
  agg: Aggregate;
}

function runSoloSweep(): { matchups: SoloResult[]; petScores: Map<string, { wr: number; samples: number; avgPetsDeployed: number; }> } {
  console.log(`[solo] running ${ALL_PETS.length}x${ALL_PETS.length} = ${ALL_PETS.length * ALL_PETS.length} matchups, ${SOLO_SAMPLES} samples each (half on each side to cancel first-player bias)...`);
  const matchups: SoloResult[] = [];
  let matchCount = 0;
  for (const defA of ALL_PETS) {
    for (const defB of ALL_PETS) {
      // We want defA's win rate vs defB, averaging over both sides.
      // Run SOLO_SAMPLES/2 with defA as side A, then SOLO_SAMPLES/2 with defA as side B.
      // When defA plays as side B, a "B wins" outcome counts toward defA's wins.
      const compA: Comp = { petIds: [defA.id] };
      const compB: Comp = { petIds: [defB.id] };
      const agg = emptyAgg();
      const halfA = Math.floor(SOLO_SAMPLES / 2);
      const halfB = SOLO_SAMPLES - halfA;
      // Side-A samples: defA = side A, defB = side B
      for (let i = 0; i < halfA; i++) {
        const r = runHeadlessMatch(compA, compB, {
          energyBudget: ENERGY_BUDGET,
          maxSeconds: MAX_SECONDS,
          seed: matchCount * 10000 + i,
        });
        add(agg, r);
        matchCount++;
      }
      // Side-B samples: defA = side B, defB = side A. We re-interpret the result
      // so the aggregate is "defA's perspective" — winner flips, scores swap.
      for (let i = 0; i < halfB; i++) {
        const raw = runHeadlessMatch(compB, compA, {
          energyBudget: ENERGY_BUDGET,
          maxSeconds: MAX_SECONDS,
          seed: matchCount * 10000 + i,
        });
        const reframed = {
          ...raw,
          winner: raw.winner === 'A' ? 'B' as const : raw.winner === 'B' ? 'A' as const : 'draw' as const,
          scoreA: raw.scoreB,
          scoreB: raw.scoreA,
          petsDeployedA: raw.petsDeployedB,
          petsDeployedB: raw.petsDeployedA,
        };
        add(agg, reframed);
        matchCount++;
      }
      matchups.push({ petA: defA.id, petB: defB.id, agg: finalize(agg) });
    }
  }
  // Aggregate per-pet across all opponents
  const petScores = new Map<string, { wr: number; samples: number; avgPetsDeployed: number; }>();
  for (const def of ALL_PETS) {
    let totalSamples = 0;
    let weightedWr = 0;
    let totalDeployed = 0;
    let totalDeployedSamples = 0;
    for (const m of matchups) {
      if (m.petA === def.id) {
        const wr = winRate(m.agg);
        weightedWr += wr * m.agg.samples;
        totalSamples += m.agg.samples;
        totalDeployed += m.agg.avgPetsDeployedA * m.agg.samples;
        totalDeployedSamples += m.agg.samples;
      }
    }
    petScores.set(def.id, {
      wr: totalSamples > 0 ? weightedWr / totalSamples : 0.5,
      samples: totalSamples,
      avgPetsDeployed: totalDeployedSamples > 0 ? totalDeployed / totalDeployedSamples : 0,
    });
  }
  return { matchups, petScores };
}

interface MultiResult {
  compA: string[];
  compB: string[];
  agg: Aggregate;
}

function randomComp(size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < size; i++) out.push(pick(ALL_PETS).id);
  return out;
}

function runMultiSweep(size: number, numComps: number, numMatchups: number, samples: number, label: string): MultiResult[] {
  console.log(`[${label}] running ${numMatchups} matchups of ${samples} samples (half on each side to cancel first-player bias)...`);
  const comps: string[][] = [];
  for (let i = 0; i < numComps; i++) comps.push(randomComp(size));
  const results: MultiResult[] = [];
  for (let i = 0; i < numMatchups; i++) {
    const a = pick(comps);
    const b = pick(comps);
    const agg = emptyAgg();
    const halfA = Math.floor(samples / 2);
    const halfB = samples - halfA;
    // Side-A samples: a = side A, b = side B
    for (let s = 0; s < halfA; s++) {
      const r = runHeadlessMatch({ petIds: a }, { petIds: b }, {
        energyBudget: ENERGY_BUDGET,
        maxSeconds: MAX_SECONDS,
        seed: i * 100000 + s,
      });
      add(agg, r);
    }
    // Side-B samples: a = side B, b = side A. Reframe so outcome is from comp a's perspective.
    for (let s = 0; s < halfB; s++) {
      const raw = runHeadlessMatch({ petIds: b }, { petIds: a }, {
        energyBudget: ENERGY_BUDGET,
        maxSeconds: MAX_SECONDS,
        seed: i * 100000 + halfA + s,
      });
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
    results.push({ compA: a, compB: b, agg: finalize(agg) });
  }
  return results;
}

function tierOf(wr: number): string {
  if (wr >= 0.65) return 'S';
  if (wr >= 0.55) return 'A';
  if (wr >= 0.45) return 'B';
  if (wr >= 0.35) return 'C';
  return 'D';
}

function writeReport(
  solo: SoloResult[],
  petScores: Map<string, { wr: number; samples: number; avgPetsDeployed: number }>,
  pairs: MultiResult[],
  triplets: MultiResult[],
): { json: string; md: string } {
  const sortedPets = [...petScores.entries()]
    .sort((a, b) => b[1].wr - a[1].wr);

  const lines: string[] = [];
  lines.push(`# Pet Painters — Balance Report`);
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Config:** energy budget ${ENERGY_BUDGET}, match cap ${MAX_SECONDS}s, win threshold ${WIN_PAINT_THRESHOLD} tiles (${Math.round(WIN_PAINT_THRESHOLD / (BOARD_SIZE * BOARD_SIZE) * 100)}% of ${BOARD_SIZE}x${BOARD_SIZE} board), ${SOLO_SAMPLES} samples per solo matchup, ${PAIR_SAMPLES} per pair matchup, ${TRIPLET_SAMPLES} per triplet matchup.`);
  lines.push('');
  lines.push(`## Tier list — solo pet by average win rate across all opponents`);
  lines.push('');
  lines.push(`| Tier | Pet | Win rate | Avg pets deployed per match |`);
  lines.push(`|---|---|---|---|`);
  for (const [petId, score] of sortedPets) {
    const def = ALL_PETS.find(d => d.id === petId)!;
    lines.push(`| ${tierOf(score.wr)} | ${def.emoji} ${def.displayName} | ${(score.wr * 100).toFixed(1)}% | ${score.avgPetsDeployed.toFixed(1)} |`);
  }
  lines.push('');

  lines.push(`## Solo win-rate matrix`);
  lines.push('');
  lines.push(`Cell = row pet's win rate vs column pet. Read across each row for a pet's matchups.`);
  lines.push('');
  const header = ['', ...ALL_PETS.map(d => d.emoji)];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);
  for (const a of ALL_PETS) {
    const row = [a.emoji];
    for (const b of ALL_PETS) {
      const m = solo.find(r => r.petA === a.id && r.petB === b.id)!;
      const wr = winRate(m.agg);
      row.push(`${(wr * 100).toFixed(0)}%`);
    }
    lines.push(`| ${row.join(' | ')} |`);
  }
  lines.push('');

  // Best counters for each pet
  lines.push(`## Best counters`);
  lines.push('');
  lines.push(`For each pet, the opponent with the highest win rate AGAINST them.`);
  lines.push('');
  lines.push(`| Target | Best counter | Counter's WR vs target |`);
  lines.push(`|---|---|---|`);
  for (const target of ALL_PETS) {
    let bestCounter: string | null = null;
    let bestCounterWr = -1;
    for (const counter of ALL_PETS) {
      if (counter.id === target.id) continue;
      const m = solo.find(r => r.petA === counter.id && r.petB === target.id)!;
      const wr = winRate(m.agg);
      if (wr > bestCounterWr) {
        bestCounterWr = wr;
        bestCounter = counter.id;
      }
    }
    if (bestCounter) {
      const tDef = ALL_PETS.find(d => d.id === target.id)!;
      const cDef = ALL_PETS.find(d => d.id === bestCounter)!;
      lines.push(`| ${tDef.emoji} ${tDef.displayName} | ${cDef.emoji} ${cDef.displayName} | ${(bestCounterWr * 100).toFixed(1)}% |`);
    }
  }
  lines.push('');

  // Most lopsided matchups
  lines.push(`## Most lopsided matchups`);
  lines.push('');
  const lopsided = [...solo]
    .filter(m => m.petA !== m.petB)
    .sort((a, b) => winRate(b.agg) - winRate(a.agg))
    .slice(0, 15);
  lines.push(`| Winner | Loser | Winner WR |`);
  lines.push(`|---|---|---|`);
  for (const m of lopsided) {
    const a = ALL_PETS.find(d => d.id === m.petA)!;
    const b = ALL_PETS.find(d => d.id === m.petB)!;
    lines.push(`| ${a.emoji} ${a.displayName} | ${b.emoji} ${b.displayName} | ${(winRate(m.agg) * 100).toFixed(1)}% |`);
  }
  lines.push('');

  // Mirror match scores
  lines.push(`## Mirror matches (sanity check)`);
  lines.push('');
  lines.push(`Each pet vs itself should be near 50% (with same comp on both sides, only RNG and slight position asymmetry matter).`);
  lines.push('');
  lines.push(`| Pet | A win rate vs same pet | Avg A score | Avg B score |`);
  lines.push(`|---|---|---|---|`);
  for (const def of ALL_PETS) {
    const m = solo.find(r => r.petA === def.id && r.petB === def.id)!;
    lines.push(`| ${def.emoji} ${def.displayName} | ${(winRate(m.agg) * 100).toFixed(1)}% | ${m.agg.avgScoreA.toFixed(1)} | ${m.agg.avgScoreB.toFixed(1)} |`);
  }
  lines.push('');

  // Pair section
  lines.push(`## Pair comps — best & worst`);
  lines.push('');
  const pairsSorted = [...pairs].sort((a, b) => winRate(b.agg) - winRate(a.agg));
  lines.push(`### Top pair comps (by win rate)`);
  lines.push('');
  lines.push(`| Pair (A) | vs Pair (B) | A win rate | Samples |`);
  lines.push(`|---|---|---|---|`);
  for (const m of pairsSorted.slice(0, 10)) {
    const aEmojis = m.compA.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const bEmojis = m.compB.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    lines.push(`| ${aEmojis} (${m.compA.join('+')}) | ${bEmojis} (${m.compB.join('+')}) | ${(winRate(m.agg) * 100).toFixed(1)}% | ${m.agg.samples} |`);
  }
  lines.push('');

  // Triplet section
  lines.push(`## Triplet comps — best & worst`);
  lines.push('');
  const tripletsSorted = [...triplets].sort((a, b) => winRate(b.agg) - winRate(a.agg));
  lines.push(`### Top triplet comps (by win rate)`);
  lines.push('');
  lines.push(`| Comp (A) | vs Comp (B) | A win rate | Samples |`);
  lines.push(`|---|---|---|---|`);
  for (const m of tripletsSorted.slice(0, 10)) {
    const aEmojis = m.compA.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const bEmojis = m.compB.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    lines.push(`| ${aEmojis} (${m.compA.join('+')}) | ${bEmojis} (${m.compB.join('+')}) | ${(winRate(m.agg) * 100).toFixed(1)}% | ${m.agg.samples} |`);
  }
  lines.push('');

  // Methodology
  lines.push(`## Methodology & caveats`);
  lines.push('');
  lines.push(`- Each match: both players get ${ENERGY_BUDGET} energy, deploy greedy in home zone (cycling through their comp). Sim runs at 20 ticks/sec for up to ${MAX_SECONDS}s or until ${WIN_PAINT_THRESHOLD} painted tiles (${Math.round(WIN_PAINT_THRESHOLD / (BOARD_SIZE * BOARD_SIZE) * 100)}%), with early-out if no paint changes for 4s (stall).`);
  lines.push(`- Player A deploys in rows 0..${HOME_ROWS - 1} facing North. Player B deploys in rows ${BOARD_SIZE - HOME_ROWS}..${BOARD_SIZE - 1} facing South. Slight asymmetry possible from movement timer alignment and deployment order — see Mirror match section to gauge bias.`);
  lines.push(`- RNG used only for movement tiebreaks. Seeded per match; reproducible.`);
  lines.push(`- "Pets deployed" reflects how many pets the budget can fit; greedy placement may leave budget unspent if home zone is full.`);
  lines.push(`- This is a synthetic test — real play has multi-round planning, energy regen, positioning skill, and counter-deploying. Treat results as a directional signal, not gospel.`);
  lines.push('');

  return {
    md: lines.join('\n'),
    json: JSON.stringify({
      config: { energyBudget: ENERGY_BUDGET, maxSeconds: MAX_SECONDS, soloSamples: SOLO_SAMPLES, pairSamples: PAIR_SAMPLES, tripletSamples: TRIPLET_SAMPLES, winThreshold: WIN_PAINT_THRESHOLD },
      solo,
      petScores: Object.fromEntries(petScores),
      pairs,
      triplets,
    }, null, 2),
  };
}

async function main() {
  const t0 = Date.now();
  const { matchups: solo, petScores } = runSoloSweep();
  const pairs = runMultiSweep(2, PAIR_COMPS, PAIR_MATCHUPS, PAIR_SAMPLES, 'pair');
  const triplets = runMultiSweep(3, TRIPLET_COMPS, TRIPLET_MATCHUPS, TRIPLET_SAMPLES, 'triplet');
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Total wall time: ${elapsed}s`);

  const { md, json } = writeReport(solo, petScores, pairs, triplets);

  const dir = join(process.cwd(), 'docs', 'balance-reports');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  const mdPath = join(dir, `report-${stamp}.md`);
  const jsonPath = join(dir, `report-${stamp}.json`);
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, json);
  console.log(`\nWrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
