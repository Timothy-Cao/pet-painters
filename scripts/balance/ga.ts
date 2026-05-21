/**
 * Coevolutionary Genetic Algorithm for Queen of Critters balance analysis.
 *
 * Two populations (offense / defense), each 50 comps (3-pet teams), coevolve
 * for up to 30 generations. Offense maximises WR vs defense population;
 * defense minimises WR allowed.
 *
 * Usage:
 *   tsx scripts/balance/ga.ts [--seed=N] [--gens=N] [--pop=N]
 */

import { ALL_PETS } from '../../src/sim/pets';
import { createRng, type Rng } from '../../src/sim/rng';
import { runHeadlessMatch, type Comp } from './sim';
import { WIN_PAINT_THRESHOLD } from '../../src/config/balance';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseCli(): { seed: number; gens: number; pop: number } {
  let seed = Date.now() >>> 0;
  let gens = 30;
  let pop = 50;
  for (const arg of process.argv.slice(2)) {
    const s = arg.match(/^--seed=(\d+)$/);
    const g = arg.match(/^--gens=(\d+)$/);
    const p = arg.match(/^--pop=(\d+)$/);
    if (s) seed = parseInt(s[1], 10) >>> 0;
    if (g) gens = parseInt(g[1], 10);
    if (p) pop = parseInt(p[1], 10);
  }
  return { seed, gens, pop };
}

// ---------------------------------------------------------------------------
// Match settings (same as runner.ts for comparability)
// ---------------------------------------------------------------------------
const ENERGY_BUDGET = 20;
const MAX_SECONDS = 60;
const WIN_THRESHOLD = WIN_PAINT_THRESHOLD;
const SAMPLES_PER_MATCHUP = 4; // 2 each side

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PetId = string;
type CompArr = [PetId, PetId, PetId];

interface Individual {
  comp: CompArr;
  fitness: number;
}

// ---------------------------------------------------------------------------
// RNG helpers (GA-level, separate from sim-level RNG)
// ---------------------------------------------------------------------------
let gaRng: Rng;

function gaRandom(): number { return gaRng.next(); }
function gaRandInt(n: number): number { return Math.floor(gaRandom() * n); }
function gaPickFrom<T>(arr: T[]): T { return arr[gaRandInt(arr.length)]; }

// ---------------------------------------------------------------------------
// Comp utilities
// ---------------------------------------------------------------------------
const PET_IDS: PetId[] = ALL_PETS.map(p => p.id);
const N_PETS = PET_IDS.length; // 13

/** Generate a random 3-pet comp (with replacement allowed — valid per game rules). */
function randomComp(): CompArr {
  return [gaPickFrom(PET_IDS), gaPickFrom(PET_IDS), gaPickFrom(PET_IDS)];
}

/** Key for dedup / hashing. Sorted canonical form. */
function compKey(c: CompArr): string {
  return [...c].sort().join('|');
}

// ---------------------------------------------------------------------------
// Fitness evaluation
// ---------------------------------------------------------------------------
let matchSeed = 1_000_000;

function evalWinRate(compA: CompArr, compB: CompArr): number {
  let winsA = 0;
  const half = Math.floor(SAMPLES_PER_MATCHUP / 2);
  const rem = SAMPLES_PER_MATCHUP - half;

  const compObjA: Comp = { petIds: compA };
  const compObjB: Comp = { petIds: compB };

  for (let i = 0; i < half; i++) {
    const r = runHeadlessMatch(compObjA, compObjB, {
      energyBudget: ENERGY_BUDGET, maxSeconds: MAX_SECONDS,
      winThreshold: WIN_THRESHOLD, seed: matchSeed++,
    });
    if (r.winner === 'A') winsA++;
    else if (r.winner === 'draw') winsA += 0.5;
  }
  for (let i = 0; i < rem; i++) {
    const r = runHeadlessMatch(compObjB, compObjA, {
      energyBudget: ENERGY_BUDGET, maxSeconds: MAX_SECONDS,
      winThreshold: WIN_THRESHOLD, seed: matchSeed++,
    });
    // reframe: compA was B
    if (r.winner === 'B') winsA++;
    else if (r.winner === 'draw') winsA += 0.5;
  }
  return winsA / SAMPLES_PER_MATCHUP;
}

/**
 * Evaluate fitness for both populations simultaneously:
 * offense.fitness = avg WR vs all defense comps
 * defense.fitness = 1 - avg WR allowed vs all offense comps
 */
function evaluateFitness(offense: Individual[], defense: Individual[]): void {
  const offSize = offense.length;
  const defSize = defense.length;

  // Accumulate matchup totals
  const offWrSum = new Array<number>(offSize).fill(0);
  const defWrSum = new Array<number>(defSize).fill(0);

  for (let oi = 0; oi < offSize; oi++) {
    for (let di = 0; di < defSize; di++) {
      const wr = evalWinRate(offense[oi].comp, defense[di].comp);
      offWrSum[oi] += wr;
      defWrSum[di] += wr; // defense's "WR allowed"
    }
  }

  for (let oi = 0; oi < offSize; oi++) {
    offense[oi].fitness = offWrSum[oi] / defSize;
  }
  for (let di = 0; di < defSize; di++) {
    defense[di].fitness = 1 - defWrSum[di] / offSize;
  }
}

// ---------------------------------------------------------------------------
// Selection + reproduction
// ---------------------------------------------------------------------------

/** In-place sort descending by fitness. */
function sortByFitness(pop: Individual[]): void {
  pop.sort((a, b) => b.fitness - a.fitness);
}

/**
 * Replace the bottom half of the population via crossover (60%) and
 * mutation (40%). Parents are drawn from the top half.
 */
function reproduce(pop: Individual[], allPetIds: PetId[]): void {
  sortByFitness(pop);
  const n = pop.length;
  const eliteN = Math.ceil(n / 2);
  const elites = pop.slice(0, eliteN);

  for (let i = eliteN; i < n; i++) {
    if (gaRandom() < 0.6) {
      // Crossover: 2 pets from parentA, 1 from parentB
      const parentA = gaPickFrom(elites);
      const parentB = gaPickFrom(elites);
      const slotFromB = gaRandInt(3);
      const child: CompArr = [...parentA.comp] as CompArr;
      child[slotFromB] = parentB.comp[slotFromB];
      pop[i] = { comp: child, fitness: 0 };
    } else {
      // Mutation: clone a parent, replace 1 random slot
      const parent = gaPickFrom(elites);
      const child: CompArr = [...parent.comp] as CompArr;
      const slot = gaRandInt(3);
      child[slot] = allPetIds[gaRandInt(allPetIds.length)];
      pop[i] = { comp: child, fitness: 0 };
    }
  }
}

// ---------------------------------------------------------------------------
// Convergence check
// ---------------------------------------------------------------------------

function topHalfMeanFitness(pop: Individual[]): number {
  const n = pop.length;
  const eliteN = Math.ceil(n / 2);
  const sorted = [...pop].sort((a, b) => b.fitness - a.fitness);
  const sum = sorted.slice(0, eliteN).reduce((s, ind) => s + ind.fitness, 0);
  return sum / eliteN;
}

function meanFitness(pop: Individual[]): number {
  return pop.reduce((s, ind) => s + ind.fitness, 0) / pop.length;
}

// ---------------------------------------------------------------------------
// Population frequency (last 5 gens)
// ---------------------------------------------------------------------------

interface FreqRecord {
  comp: CompArr;
  offFreq: number;
  defFreq: number;
}

function computeFrequencies(
  offHistory: CompArr[][],
  defHistory: CompArr[][],
): FreqRecord[] {
  const offCounts = new Map<string, { comp: CompArr; count: number }>();
  const defCounts = new Map<string, { comp: CompArr; count: number }>();

  for (const snapshot of offHistory) {
    for (const comp of snapshot) {
      const key = compKey(comp);
      const entry = offCounts.get(key);
      if (entry) entry.count++;
      else offCounts.set(key, { comp, count: 1 });
    }
  }
  for (const snapshot of defHistory) {
    for (const comp of snapshot) {
      const key = compKey(comp);
      const entry = defCounts.get(key);
      if (entry) entry.count++;
      else defCounts.set(key, { comp, count: 1 });
    }
  }

  const allKeys = new Set([...offCounts.keys(), ...defCounts.keys()]);
  const totalOff = offHistory.reduce((s, snap) => s + snap.length, 0);
  const totalDef = defHistory.reduce((s, snap) => s + snap.length, 0);

  const records: FreqRecord[] = [];
  for (const key of allKeys) {
    const offEntry = offCounts.get(key);
    const defEntry = defCounts.get(key);
    const comp = (offEntry ?? defEntry)!.comp;
    records.push({
      comp,
      offFreq: offEntry ? offEntry.count / totalOff : 0,
      defFreq: defEntry ? defEntry.count / totalDef : 0,
    });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Per-pet appearance rate in final populations
// ---------------------------------------------------------------------------

function computePetAppearanceRates(
  offPop: Individual[],
  defPop: Individual[],
): Map<PetId, { offRate: number; defRate: number; combinedRate: number }> {
  const result = new Map<PetId, { offRate: number; defRate: number; combinedRate: number }>();
  for (const p of ALL_PETS) {
    result.set(p.id, { offRate: 0, defRate: 0, combinedRate: 0 });
  }

  for (const ind of offPop) {
    const seen = new Set(ind.comp);
    for (const id of seen) {
      const r = result.get(id)!;
      r.offRate += 1 / offPop.length;
    }
  }
  for (const ind of defPop) {
    const seen = new Set(ind.comp);
    for (const id of seen) {
      const r = result.get(id)!;
      r.defRate += 1 / defPop.length;
    }
  }
  const total = offPop.length + defPop.length;
  for (const ind of [...offPop, ...defPop]) {
    const seen = new Set(ind.comp);
    for (const id of seen) {
      const r = result.get(id)!;
      r.combinedRate += 1 / total;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function emojiFor(id: PetId): string {
  return ALL_PETS.find(p => p.id === id)?.emoji ?? '?';
}
function displayFor(id: PetId): string {
  return ALL_PETS.find(p => p.id === id)?.displayName ?? id;
}
function compEmoji(comp: CompArr): string {
  return comp.map(emojiFor).join('+');
}
function compIds(comp: CompArr): string {
  return comp.join('+');
}

interface GenRecord {
  gen: number;
  topOffFitness: number;
  topDefFitness: number;
  meanOffFitness: number;
  meanDefFitness: number;
  topOffComp: CompArr;
  topDefComp: CompArr;
}

function writeReport(opts: {
  seed: number;
  gens: number;
  pop: number;
  genRecords: GenRecord[];
  finalOffense: Individual[];
  finalDefense: Individual[];
  offHistory: CompArr[][];
  defHistory: CompArr[][];
  petAppearance: Map<PetId, { offRate: number; defRate: number; combinedRate: number }>;
  bruteForceTopComps?: Array<{ comp: string[]; wr: number }>;
  elapsedSec: number;
}): { md: string; json: string } {
  const {
    seed, gens, pop, genRecords, finalOffense, finalDefense,
    offHistory, defHistory, petAppearance, bruteForceTopComps, elapsedSec,
  } = opts;

  const freqs = computeFrequencies(offHistory, defHistory);
  const topOff = [...freqs].sort((a, b) => b.offFreq - a.offFreq).slice(0, 10);
  const topDef = [...freqs].sort((a, b) => b.defFreq - a.defFreq).slice(0, 10);

  const md: string[] = [];
  md.push('# Coevolutionary GA — Balance Report (Round 1)');
  md.push('');
  md.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  md.push(`**Seed:** ${seed} | **Generations:** ${genRecords.length} | **Pop size:** ${pop} | **Samples/matchup:** ${SAMPLES_PER_MATCHUP}`);
  md.push(`**Total matches:** ~${(genRecords.length * pop * pop * SAMPLES_PER_MATCHUP).toLocaleString()} | **Wall time:** ${elapsedSec.toFixed(1)}s`);
  md.push('');

  // Top 10 offense comps
  md.push('## Top 10 most-frequent OFFENSE comps (smoothed over last 5 gens)');
  md.push('');
  md.push('| Rank | Comp | Offense Freq | Defense Freq |');
  md.push('|---|---|---|---|');
  for (let i = 0; i < topOff.length; i++) {
    const r = topOff[i];
    md.push(`| ${i + 1} | ${compEmoji(r.comp)} (${compIds(r.comp)}) | ${(r.offFreq * 100).toFixed(1)}% | ${(r.defFreq * 100).toFixed(1)}% |`);
  }
  md.push('');

  // Top 10 defense comps
  md.push('## Top 10 most-frequent DEFENSE comps (smoothed over last 5 gens)');
  md.push('');
  md.push('| Rank | Comp | Defense Freq | Offense Freq |');
  md.push('|---|---|---|---|');
  for (let i = 0; i < topDef.length; i++) {
    const r = topDef[i];
    md.push(`| ${i + 1} | ${compEmoji(r.comp)} (${compIds(r.comp)}) | ${(r.defFreq * 100).toFixed(1)}% | ${(r.offFreq * 100).toFixed(1)}% |`);
  }
  md.push('');

  // Per-pet appearance rate
  md.push('## Per-pet appearance rate in final GA populations');
  md.push('');
  md.push('| Pet | Offense Pop | Defense Pop | Combined |');
  md.push('|---|---|---|---|');
  const sortedPets = [...petAppearance.entries()].sort((a, b) => b[1].combinedRate - a[1].combinedRate);
  for (const [id, rates] of sortedPets) {
    const def = ALL_PETS.find(p => p.id === id)!;
    md.push(`| ${def.emoji} ${def.displayName} | ${(rates.offRate * 100).toFixed(1)}% | ${(rates.defRate * 100).toFixed(1)}% | ${(rates.combinedRate * 100).toFixed(1)}% |`);
  }
  md.push('');

  // Comparison to brute force
  md.push('## Comparison to brute-force meta sweep');
  md.push('');
  if (bruteForceTopComps && bruteForceTopComps.length > 0) {
    md.push('Top GA offense comps vs brute-force top-WR comps:');
    md.push('');
    const bfKeys = new Set(bruteForceTopComps.map(c => [...c.comp].sort().join('|')));
    let gaHits = 0;
    for (const r of topOff) {
      const key = compKey(r.comp);
      const hit = bfKeys.has(key);
      if (hit) gaHits++;
      md.push(`- ${compEmoji(r.comp)} (${compIds(r.comp)}) — ${hit ? '**Found by brute force**' : 'GA-only discovery'}`);
    }
    md.push('');
    md.push(`GA offense recovered ${gaHits}/${topOff.length} brute-force top comps.`);

    // Brute-force comps missed by GA
    const gaOffKeys = new Set(topOff.map(r => compKey(r.comp)));
    const missed = bruteForceTopComps.filter(c => !gaOffKeys.has([...c.comp].sort().join('|')));
    if (missed.length > 0) {
      md.push('');
      md.push('Brute-force top comps NOT in GA top-10 offense:');
      for (const c of missed.slice(0, 10)) {
        const emojis = c.comp.map(emojiFor).join('+');
        md.push(`- ${emojis} (${c.comp.join('+')}) WR=${( c.wr * 100).toFixed(1)}%`);
      }
    }
  } else {
    md.push('*(Brute-force data not provided — run `npm run balance` to generate.)*');
  }
  md.push('');

  // Fitness curve
  md.push('## Per-generation fitness curve');
  md.push('');
  md.push('| Gen | Top Off | Top Def | Mean Off | Mean Def | Top Off Comp | Top Def Comp |');
  md.push('|---|---|---|---|---|---|---|');
  for (const rec of genRecords) {
    md.push(`| ${rec.gen} | ${(rec.topOffFitness * 100).toFixed(1)}% | ${(rec.topDefFitness * 100).toFixed(1)}% | ${(rec.meanOffFitness * 100).toFixed(1)}% | ${(rec.meanDefFitness * 100).toFixed(1)}% | ${compEmoji(rec.topOffComp)} | ${compEmoji(rec.topDefComp)} |`);
  }
  md.push('');

  // Takeaways
  md.push('## Takeaways');
  md.push('');

  // Auto-generate takeaways based on data
  const finalSortedOff = [...finalOffense].sort((a, b) => b.fitness - a.fitness);
  const finalSortedDef = [...finalDefense].sort((a, b) => b.fitness - a.fitness);

  // Find pets that appear in ≥70% of offense or defense pop
  const dominantPets = [...petAppearance.entries()].filter(([, r]) => r.offRate >= 0.7 || r.defRate >= 0.7);
  const absentPets = [...petAppearance.entries()].filter(([, r]) => r.combinedRate === 0);

  if (dominantPets.length > 0) {
    const names = dominantPets.map(([id]) => `${emojiFor(id)} ${displayFor(id)}`).join(', ');
    md.push(`1. **Dominant pets (≥70% appearance):** ${names}. These over-index in GA and may need a cost increase or ability nerf.`);
  } else {
    md.push('1. **No dominant pets (≥70%):** GA populations are reasonably diverse — no single pet monopolises the optimal-comp landscape.');
  }

  if (absentPets.length > 0) {
    const names = absentPets.map(([id]) => `${emojiFor(id)} ${displayFor(id)}`).join(', ');
    md.push(`2. **Absent pets (0% in final pops):** ${names}. GA never selected them — they are fundamentally undertuned relative to budget.`);
  } else {
    md.push('2. **All pets represented:** Every pet appeared at least once in final populations — no pet is completely unviable.');
  }

  const firstGenOff = genRecords[0]?.meanOffFitness ?? 0.5;
  const lastGenOff = genRecords[genRecords.length - 1]?.meanOffFitness ?? 0.5;
  const improvement = ((lastGenOff - firstGenOff) * 100).toFixed(1);
  md.push(`3. **GA convergence:** Mean offense fitness improved by ${improvement}pp from gen 1 to gen ${genRecords.length}, indicating genuine selection pressure.`);

  // Overlap between top offense and top defense
  const topOffKeys = new Set(topOff.map(r => compKey(r.comp)));
  const overlap = topDef.filter(r => topOffKeys.has(compKey(r.comp)));
  if (overlap.length > 0) {
    const names = overlap.map(r => compEmoji(r.comp)).join(', ');
    md.push(`4. **Nash-like stable comps:** ${names} appear in both top-10 offense AND defense, suggesting they are close to Nash-equilibrium strategies.`);
  } else {
    md.push('4. **No Nash-stable comps:** Top offense and defense comps are disjoint — offense and defense favour different strategies (rock-paper-scissors dynamic).');
  }

  const finalTopOff = finalSortedOff[0];
  const finalTopDef = finalSortedDef[0];
  md.push(`5. **Best final comp:** Offense: ${compEmoji(finalTopOff.comp)} (fitness ${(finalTopOff.fitness * 100).toFixed(1)}%), Defense: ${compEmoji(finalTopDef.comp)} (fitness ${(finalTopDef.fitness * 100).toFixed(1)}%).`);
  md.push('');

  // Outlier verdict
  md.push('## Balance verdict');
  md.push('');
  if (dominantPets.length > 0 || absentPets.length > 0) {
    md.push('**GA triggered follow-up:** One or more pets exceed the 70% / 0% threshold.');
    if (dominantPets.length > 0) {
      md.push('');
      md.push('Recommended nerfable pets (>70% appearance):');
      for (const [id, r] of dominantPets) {
        const def = ALL_PETS.find(p => p.id === id)!;
        md.push(`- ${def.emoji} ${def.displayName} (off: ${(r.offRate * 100).toFixed(0)}%, def: ${(r.defRate * 100).toFixed(0)}%) — consider cost +1 or ability cap`);
      }
    }
    if (absentPets.length > 0) {
      md.push('');
      md.push('Recommended buffable pets (0% appearance):');
      for (const [id] of absentPets) {
        const def = ALL_PETS.find(p => p.id === id)!;
        md.push(`- ${def.emoji} ${def.displayName} (cost ${def.cost}) — consider cost -1 or small ability buff`);
      }
    }
  } else {
    md.push('**No GA-triggered balance followup needed.** All pets appear in at least one final comp, and no pet exceeds 70% combined appearance. The game appears reasonably balanced for v1 release within this GA methodology.');
  }
  md.push('');

  // JSON output
  const json = JSON.stringify({
    config: { seed, gens, pop, samplesPerMatchup: SAMPLES_PER_MATCHUP, energyBudget: ENERGY_BUDGET, maxSeconds: MAX_SECONDS },
    genRecords,
    finalOffense: finalSortedOff.map(ind => ({ comp: ind.comp, fitness: ind.fitness })),
    finalDefense: finalSortedDef.map(ind => ({ comp: ind.comp, fitness: ind.fitness })),
    topOffenseComps: topOff,
    topDefenseComps: topDef,
    petAppearanceRates: Object.fromEntries([...petAppearance.entries()].map(([id, r]) => [id, r])),
  }, null, 2);

  return { md: md.join('\n'), json };
}

// ---------------------------------------------------------------------------
// Main GA loop
// ---------------------------------------------------------------------------

async function main() {
  const { seed, gens, pop } = parseCli();
  gaRng = createRng(seed);

  console.log(`Coevolutionary GA — seed=${seed}, gens=${gens}, pop=${pop}`);
  console.log(`Matches/gen: ${pop} × ${pop} × ${SAMPLES_PER_MATCHUP} = ${pop * pop * SAMPLES_PER_MATCHUP}`);
  console.log(`Estimated total matches: ${gens * pop * pop * SAMPLES_PER_MATCHUP}`);
  console.log('');

  const t0 = Date.now();

  // Initialize populations
  let offense: Individual[] = Array.from({ length: pop }, () => ({ comp: randomComp(), fitness: 0 }));
  let defense: Individual[] = Array.from({ length: pop }, () => ({ comp: randomComp(), fitness: 0 }));

  const genRecords: GenRecord[] = [];
  const offSnapshots: CompArr[][] = []; // all-gen snapshots (last 5 captured below)
  const defSnapshots: CompArr[][] = [];

  // Convergence tracking
  let convergeCount = 0;
  let lastMeanOff = 0;
  let lastMeanDef = 0;

  for (let gen = 1; gen <= gens; gen++) {
    const genT0 = Date.now();

    // Evaluate fitness
    evaluateFitness(offense, defense);

    // Sort
    sortByFitness(offense);
    sortByFitness(defense);

    const topOff = offense[0];
    const topDef = defense[0];
    const mOff = meanFitness(offense);
    const mDef = meanFitness(defense);

    genRecords.push({
      gen,
      topOffFitness: topOff.fitness,
      topDefFitness: topDef.fitness,
      meanOffFitness: mOff,
      meanDefFitness: mDef,
      topOffComp: [...topOff.comp] as CompArr,
      topDefComp: [...topDef.comp] as CompArr,
    });

    const elapsed = ((Date.now() - genT0) / 1000).toFixed(1);
    console.log(
      `gen ${String(gen).padStart(2)}: ` +
      `top off ${(topOff.fitness * 100).toFixed(1)}%  ` +
      `top def ${(topDef.fitness * 100).toFixed(1)}%  ` +
      `mean off ${(mOff * 100).toFixed(1)}%  ` +
      `mean def ${(mDef * 100).toFixed(1)}%  ` +
      `(${elapsed}s)  ` +
      `off: ${compEmoji(topOff.comp)}  def: ${compEmoji(topDef.comp)}`
    );

    // Save snapshot every 5 gens
    if (gen % 5 === 0 || gen === gens) {
      offSnapshots.push(offense.map(ind => [...ind.comp] as CompArr));
      defSnapshots.push(defense.map(ind => [...ind.comp] as CompArr));
    }

    // Convergence check: top-half fitness stable <2pp for 3 consecutive gens
    const topHalfOff = topHalfMeanFitness(offense);
    const topHalfDef = topHalfMeanFitness(defense);
    if (
      Math.abs(topHalfOff - lastMeanOff) < 0.02 &&
      Math.abs(topHalfDef - lastMeanDef) < 0.02 &&
      gen > 3
    ) {
      convergeCount++;
      if (convergeCount >= 3) {
        console.log(`\nConverged at gen ${gen} (top-half fitness stable <2pp for 3 gens).`);
        break;
      }
    } else {
      convergeCount = 0;
    }
    lastMeanOff = topHalfOff;
    lastMeanDef = topHalfDef;

    // Reproduce for next generation (skip on last gen)
    if (gen < gens) {
      reproduce(offense, PET_IDS);
      reproduce(defense, PET_IDS);
    }
  }

  // Final evaluation (ensure final pop is evaluated after last reproduce)
  evaluateFitness(offense, defense);
  sortByFitness(offense);
  sortByFitness(defense);

  // Ensure we have at least the last snapshot
  if (offSnapshots.length === 0) {
    offSnapshots.push(offense.map(ind => [...ind.comp] as CompArr));
    defSnapshots.push(defense.map(ind => [...ind.comp] as CompArr));
  }
  // Keep only last 5 snapshots for frequency smoothing
  const lastOffSnapshots = offSnapshots.slice(-5);
  const lastDefSnapshots = defSnapshots.slice(-5);

  const petAppearance = computePetAppearanceRates(offense, defense);

  const elapsedSec = (Date.now() - t0) / 1000;
  console.log(`\nTotal wall time: ${elapsedSec.toFixed(1)}s`);

  // Load brute force data if available (most recent report JSON)
  let bruteForceTopComps: Array<{ comp: string[]; wr: number }> | undefined;
  try {
    const { readdirSync } = await import('node:fs');
    const dir = join(process.cwd(), 'docs', 'balance-reports');
    const files = readdirSync(dir).filter(f => f.startsWith('report-') && f.endsWith('.json'));
    if (files.length > 0) {
      files.sort();
      const latest = files[files.length - 1];
      const { readFileSync } = await import('node:fs');
      const data = JSON.parse(readFileSync(join(dir, latest), 'utf-8'));
      if (data.topComps) {
        bruteForceTopComps = data.topComps.slice(0, 20);
      }
    }
  } catch {
    // ignore
  }

  const { md, json } = writeReport({
    seed, gens, pop, genRecords,
    finalOffense: offense,
    finalDefense: defense,
    offHistory: lastOffSnapshots,
    defHistory: lastDefSnapshots,
    petAppearance,
    bruteForceTopComps,
    elapsedSec,
  });

  const outDir = join(process.cwd(), 'docs', 'balance-reports');
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, 'ga-r1.md');
  const jsonPath = join(outDir, 'ga-r1.json');

  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, json);
  console.log(`\nWrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);

  // Print summary
  console.log('\n=== FINAL SUMMARY ===');
  console.log('Top offense comp:', compEmoji(offense[0].comp), `(fitness ${(offense[0].fitness * 100).toFixed(1)}%)`);
  console.log('Top defense comp:', compEmoji(defense[0].comp), `(fitness ${(defense[0].fitness * 100).toFixed(1)}%)`);
  console.log('\nPer-pet combined appearance rate:');
  const sortedApp = [...petAppearance.entries()].sort((a, b) => b[1].combinedRate - a[1].combinedRate);
  for (const [id, r] of sortedApp) {
    const def = ALL_PETS.find(p => p.id === id)!;
    const bar = '█'.repeat(Math.round(r.combinedRate * 20));
    console.log(`  ${def.emoji} ${def.displayName.padEnd(10)} ${(r.combinedRate * 100).toFixed(1).padStart(5)}%  ${bar}`);
  }

  // Trigger warning
  const dominantPets = sortedApp.filter(([, r]) => r.offRate >= 0.7 || r.defRate >= 0.7);
  const absentPets = sortedApp.filter(([, r]) => r.combinedRate === 0);
  if (dominantPets.length > 0) {
    console.log('\n⚠ BALANCE ALERT: Dominant pets (≥70%):');
    for (const [id, r] of dominantPets) {
      const def = ALL_PETS.find(p => p.id === id)!;
      console.log(`  ${def.emoji} ${def.displayName}: off=${(r.offRate * 100).toFixed(0)}% def=${(r.defRate * 100).toFixed(0)}%`);
    }
  }
  if (absentPets.length > 0) {
    console.log('\n⚠ BALANCE ALERT: Absent pets (0%):');
    for (const [id] of absentPets) {
      const def = ALL_PETS.find(p => p.id === id)!;
      console.log(`  ${def.emoji} ${def.displayName} (cost ${def.cost})`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
