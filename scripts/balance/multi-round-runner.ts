/**
 * Multi-round balance runner.
 * Same 455-comp sweep as runner.ts but using the multi-round simulation methodology.
 *
 * Usage:
 *   npm run balance:multi
 *   npm run balance:multi -- --threshold=153
 */
import { ALL_PETS } from '../../src/sim/pets';
import { runMultiRoundMatch, type Comp, type MultiRoundMatchResult } from './multi-round-sim';
import { WIN_PAINT_THRESHOLD } from '../../src/config/balance';
import { BOARD_SIZE } from '../../src/config/constants';
import { writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// CLI options
// ---------------------------------------------------------------------------

function parseThreshold(): number {
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--threshold=(\d+)$/);
    if (m) return parseInt(m[1], 10);
  }
  return WIN_PAINT_THRESHOLD;
}

const WIN_THRESHOLD = parseThreshold();
const WIN_PCT = Math.round((WIN_THRESHOLD / (BOARD_SIZE * BOARD_SIZE)) * 100);

// Team-comp sweep settings (same as single-phase runner)
const TEAM_OPPONENTS = 25;
const TEAM_SAMPLES = 10;

// Multi-round specific options
const MAX_ROUNDS = 8;
const EXEC_SECONDS = 5;
const START_ENERGY = 3;

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

interface Aggregate {
  winsA: number;
  winsB: number;
  draws: number;
  avgScoreA: number;
  avgScoreB: number;
  avgPetsDeployedA: number;
  avgPetsDeployedB: number;
  avgRoundsPlayed: number;
  avgTotalTicks: number;
  endByPaint: number;
  endByRoundCap: number;
  endByStall: number;
  samples: number;
}

function emptyAgg(): Aggregate {
  return {
    winsA: 0, winsB: 0, draws: 0,
    avgScoreA: 0, avgScoreB: 0,
    avgPetsDeployedA: 0, avgPetsDeployedB: 0,
    avgRoundsPlayed: 0, avgTotalTicks: 0,
    endByPaint: 0, endByRoundCap: 0, endByStall: 0,
    samples: 0,
  };
}

function add(agg: Aggregate, r: MultiRoundMatchResult): void {
  agg.samples++;
  if (r.winner === 'A') agg.winsA++;
  else if (r.winner === 'B') agg.winsB++;
  else agg.draws++;
  agg.avgScoreA += r.scoreA;
  agg.avgScoreB += r.scoreB;
  agg.avgPetsDeployedA += r.petsDeployedA;
  agg.avgPetsDeployedB += r.petsDeployedB;
  agg.avgRoundsPlayed += r.roundsPlayed;
  agg.avgTotalTicks += r.totalTicks;
  if (r.reason === 'paint_threshold') agg.endByPaint++;
  else if (r.reason === 'round_cap') agg.endByRoundCap++;
  else agg.endByStall++;
}

function finalize(agg: Aggregate): Aggregate {
  if (agg.samples === 0) return agg;
  const n = agg.samples;
  return {
    ...agg,
    avgScoreA: agg.avgScoreA / n,
    avgScoreB: agg.avgScoreB / n,
    avgPetsDeployedA: agg.avgPetsDeployedA / n,
    avgPetsDeployedB: agg.avgPetsDeployedB / n,
    avgRoundsPlayed: agg.avgRoundsPlayed / n,
    avgTotalTicks: agg.avgTotalTicks / n,
  };
}

function winRate(agg: Aggregate): number {
  if (agg.samples === 0) return 0.5;
  return (agg.winsA + agg.draws * 0.5) / agg.samples;
}

// ---------------------------------------------------------------------------
// Seeded pick RNG (independent of match RNG)
// ---------------------------------------------------------------------------

let pickSeed = 0xC0FFEE;
function pickRng(): number {
  pickSeed = (pickSeed * 1103515245 + 12345) >>> 0;
  return pickSeed / 4294967296;
}
function pickIdx(n: number): number { return Math.floor(pickRng() * n); }

// ---------------------------------------------------------------------------
// Comp enumeration (same 455 as runner.ts)
// ---------------------------------------------------------------------------

type CompDef = string[];

function enumerateComps(): CompDef[] {
  const comps: CompDef[] = [];
  const ids = ALL_PETS.map(p => p.id);

  // 3-of-one
  for (const x of ids) comps.push([x, x, x]);

  // 2:1
  for (const x of ids) {
    for (const y of ids) {
      if (y !== x) comps.push([x, x, y]);
    }
  }

  // 1:1:1
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (let k = j + 1; k < ids.length; k++) {
        comps.push([ids[i], ids[j], ids[k]].sort());
      }
    }
  }

  return comps;
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

interface CompResult {
  comp: CompDef;
  compIdx: number;
  agg: Aggregate;
}

function runTeamSweep(comps: CompDef[]): CompResult[] {
  const totalMatches = comps.length * TEAM_OPPONENTS * TEAM_SAMPLES;
  console.log(`[multi-round] ${comps.length} comps × ${TEAM_OPPONENTS} opponents × ${TEAM_SAMPLES} samples = ${totalMatches} matches`);
  console.log(`Config: ${MAX_ROUNDS} rounds/match, ${EXEC_SECONDS}s/round, start energy ${START_ENERGY}, win threshold ${WIN_THRESHOLD} (${WIN_PCT}%)`);

  const results: CompResult[] = comps.map((comp, idx) => ({ comp, compIdx: idx, agg: emptyAgg() }));
  let matchSeed = 0;

  for (let ci = 0; ci < comps.length; ci++) {
    const comp = comps[ci];
    for (let oi = 0; oi < TEAM_OPPONENTS; oi++) {
      let oppIdx: number;
      do { oppIdx = pickIdx(comps.length); } while (oppIdx === ci);
      const opp = comps[oppIdx];

      const halfA = Math.floor(TEAM_SAMPLES / 2);
      const halfB = TEAM_SAMPLES - halfA;

      // Side-A samples
      for (let s = 0; s < halfA; s++) {
        const r = runMultiRoundMatch(
          { petIds: comp },
          { petIds: opp },
          {
            maxRounds: MAX_ROUNDS,
            execSeconds: EXEC_SECONDS,
            startEnergy: START_ENERGY,
            winThreshold: WIN_THRESHOLD,
            seed: matchSeed++,
          },
        );
        add(results[ci].agg, r);
      }

      // Side-B samples (reframed to comp's perspective)
      for (let s = 0; s < halfB; s++) {
        const raw = runMultiRoundMatch(
          { petIds: opp },
          { petIds: comp },
          {
            maxRounds: MAX_ROUNDS,
            execSeconds: EXEC_SECONDS,
            startEnergy: START_ENERGY,
            winThreshold: WIN_THRESHOLD,
            seed: matchSeed++,
          },
        );
        const reframed: MultiRoundMatchResult = {
          ...raw,
          winner: raw.winner === 'A' ? 'B' : raw.winner === 'B' ? 'A' : 'draw',
          scoreA: raw.scoreB,
          scoreB: raw.scoreA,
          petsDeployedA: raw.petsDeployedB,
          petsDeployedB: raw.petsDeployedA,
        };
        add(results[ci].agg, reframed);
      }
    }
    results[ci].agg = finalize(results[ci].agg);

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

function computeTeamWr(results: CompResult[]): Map<string, PetTeamScore> {
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
// Match-length stats (aggregated across all results)
// ---------------------------------------------------------------------------

interface MatchLengthStats {
  avgRoundsPlayed: number;
  avgTicksPerMatch: number;
  pctPaint: number;
  pctRoundCap: number;
  pctStall: number;
  totalSamples: number;
}

function computeMatchLengthStats(results: CompResult[]): MatchLengthStats {
  let totalSamples = 0;
  let sumRounds = 0;
  let sumTicks = 0;
  let sumPaint = 0;
  let sumRoundCap = 0;
  let sumStall = 0;
  for (const cr of results) {
    const n = cr.agg.samples;
    totalSamples += n;
    sumRounds += cr.agg.avgRoundsPlayed * n;
    sumTicks += cr.agg.avgTotalTicks * n;
    sumPaint += cr.agg.endByPaint;
    sumRoundCap += cr.agg.endByRoundCap;
    sumStall += cr.agg.endByStall;
  }
  return {
    avgRoundsPlayed: totalSamples > 0 ? sumRounds / totalSamples : 0,
    avgTicksPerMatch: totalSamples > 0 ? sumTicks / totalSamples : 0,
    pctPaint: totalSamples > 0 ? (sumPaint / totalSamples) * 100 : 0,
    pctRoundCap: totalSamples > 0 ? (sumRoundCap / totalSamples) * 100 : 0,
    pctStall: totalSamples > 0 ? (sumStall / totalSamples) * 100 : 0,
    totalSamples,
  };
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
// Load single-phase comparison data
// ---------------------------------------------------------------------------

function loadLatestSinglePhaseWrs(): Map<string, number> | null {
  try {
    const dir = join(process.cwd(), 'docs', 'balance-reports');
    const files = readdirSync(dir)
      .filter(f => f.startsWith('report-') && f.endsWith('.json') && !f.includes('multiround'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    const raw = readFileSync(join(dir, files[0]), 'utf-8');
    const data = JSON.parse(raw);
    if (!data.teamWrs) return null;
    const map = new Map<string, number>();
    for (const [id, val] of Object.entries(data.teamWrs)) {
      map.set(id, (val as { teamWr: number }).teamWr);
    }
    return map;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function writeReport(
  comps: CompDef[],
  results: CompResult[],
  teamWrs: Map<string, PetTeamScore>,
  matchStats: MatchLengthStats,
): { json: string; md: string } {
  const sortedPets = [...teamWrs.values()].sort((a, b) => b.teamWr - a.teamWr);
  const sortedComps = [...results].sort((a, b) => winRate(b.agg) - winRate(a.agg));

  // Load single-phase data for comparison
  const singlePhaseWrs = loadLatestSinglePhaseWrs();

  const lines: string[] = [];
  lines.push(`# Pet Painters — Balance Report (Multi-Round Methodology)`);
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Config:** start energy ${START_ENERGY}, energy cap 10, ${MAX_ROUNDS} rounds/match, ${EXEC_SECONDS}s execution/round, win threshold ${WIN_THRESHOLD} tiles (${WIN_PCT}% of ${BOARD_SIZE}×${BOARD_SIZE} board).`);
  lines.push(`**Sweep:** ${comps.length} unique 3-pet comps × ${TEAM_OPPONENTS} random opponents × ${TEAM_SAMPLES} samples (half each side) = ${comps.length * TEAM_OPPONENTS * TEAM_SAMPLES} total matches.`);
  lines.push('');

  // Comparison intro
  lines.push(`## Comparison vs Single-Phase Methodology`);
  lines.push('');
  if (singlePhaseWrs) {
    lines.push(`*Single-phase reference: latest report in docs/balance-reports/ (greedy deploy, 20-energy budget, 30s cap).*`);
    lines.push('');
    lines.push(`| Pet | Multi-Round WR | Single-Phase WR | Delta | Direction |`);
    lines.push(`|---|---|---|---|---|`);
    const compared = sortedPets.map(s => {
      const sp = singlePhaseWrs.get(s.petId) ?? 0.5;
      const delta = s.teamWr - sp;
      return { ...s, singlePhaseWr: sp, delta };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    for (const row of compared) {
      const def = ALL_PETS.find(d => d.id === row.petId)!;
      const sign = row.delta >= 0 ? '+' : '';
      const dir = Math.abs(row.delta) < 0.01 ? '↔' : row.delta > 0 ? '↑' : '↓';
      lines.push(`| ${def.emoji} ${def.displayName} | ${(row.teamWr * 100).toFixed(1)}% | ${(row.singlePhaseWr * 100).toFixed(1)}% | ${sign}${(row.delta * 100).toFixed(1)}% | ${dir} |`);
    }
    lines.push('');

    // Key deltas narrative
    const risers = compared.filter(r => r.delta > 0.03).sort((a, b) => b.delta - a.delta);
    const fallers = compared.filter(r => r.delta < -0.03).sort((a, b) => a.delta - b.delta);
    if (risers.length > 0) {
      lines.push(`**Notable risers:** ${risers.map(r => {
        const def = ALL_PETS.find(d => d.id === r.petId)!;
        return `${def.emoji} ${def.displayName} (+${(r.delta * 100).toFixed(1)}%)`;
      }).join(', ')}`);
      lines.push('');
    }
    if (fallers.length > 0) {
      lines.push(`**Notable fallers:** ${fallers.map(r => {
        const def = ALL_PETS.find(d => d.id === r.petId)!;
        return `${def.emoji} ${def.displayName} (${(r.delta * 100).toFixed(1)}%)`;
      }).join(', ')}`);
      lines.push('');
    }
  } else {
    lines.push('*No single-phase report found for comparison.*');
    lines.push('');
  }

  // Match-length stats
  lines.push(`## Match-length statistics`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Avg rounds played | ${matchStats.avgRoundsPlayed.toFixed(2)} / ${MAX_ROUNDS} |`);
  lines.push(`| Avg ticks per match | ${matchStats.avgTicksPerMatch.toFixed(0)} ticks (${(matchStats.avgTicksPerMatch / 20).toFixed(1)} game-seconds) |`);
  lines.push(`| Ended by paint threshold | ${matchStats.pctPaint.toFixed(1)}% |`);
  lines.push(`| Ended by round cap | ${matchStats.pctRoundCap.toFixed(1)}% |`);
  lines.push(`| Ended by stall | ${matchStats.pctStall.toFixed(1)}% |`);
  lines.push(`| Total matches analyzed | ${matchStats.totalSamples.toLocaleString()} |`);
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
  lines.push(`## Top 20 comps`);
  lines.push('');
  lines.push(`| Comp | Win rate | Avg rounds | Samples |`);
  lines.push(`|---|---|---|---|`);
  for (const cr of sortedComps.slice(0, 20)) {
    const emojis = cr.comp.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const ids = cr.comp.join('+');
    lines.push(`| ${emojis} (${ids}) | ${(winRate(cr.agg) * 100).toFixed(1)}% | ${cr.agg.avgRoundsPlayed.toFixed(1)} | ${cr.agg.samples} |`);
  }
  lines.push('');

  // Bottom 20 comps
  lines.push(`## Bottom 20 comps`);
  lines.push('');
  lines.push(`| Comp | Win rate | Avg rounds | Samples |`);
  lines.push(`|---|---|---|---|`);
  for (const cr of sortedComps.slice(-20).reverse()) {
    const emojis = cr.comp.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const ids = cr.comp.join('+');
    lines.push(`| ${emojis} (${ids}) | ${(winRate(cr.agg) * 100).toFixed(1)}% | ${cr.agg.avgRoundsPlayed.toFixed(1)} | ${cr.agg.samples} |`);
  }
  lines.push('');

  // Methodology
  lines.push(`## Methodology`);
  lines.push('');
  lines.push(`- **Match flow:** up to ${MAX_ROUNDS} rounds. Each round: draw 3 pets randomly from comp (with replacement), attempt random placement in home zone (up to 10 retries per pet). Then run ${EXEC_SECONDS}s execution phase. Energy regens +1/sec during execution.`);
  lines.push(`- **Starting energy:** ${START_ENERGY}. Cap: 10.`);
  lines.push(`- **Comp types:** 13 three-of-one + 156 two-one + 286 all-different = 455 unique 3-pet comps.`);
  lines.push(`- **Per comp:** ${TEAM_OPPONENTS} random opponents × ${TEAM_SAMPLES} samples (${Math.floor(TEAM_SAMPLES / 2)} as side A, ${TEAM_SAMPLES - Math.floor(TEAM_SAMPLES / 2)} as side B). Side-B reframed to comp's perspective.`);
  lines.push(`- **Win threshold:** ${WIN_THRESHOLD} tiles (${WIN_PCT}% of board). Stall: no paint change for 10s total across match.`);
  lines.push(`- **Determinism:** per-match seeded PRNG drives both pet draws and sim ticks.`);
  lines.push('');

  return {
    md: lines.join('\n'),
    json: JSON.stringify({
      config: {
        maxRounds: MAX_ROUNDS, execSeconds: EXEC_SECONDS, startEnergy: START_ENERGY,
        winThreshold: WIN_THRESHOLD, winPct: WIN_PCT,
        teamOpponents: TEAM_OPPONENTS, teamSamples: TEAM_SAMPLES,
      },
      matchStats,
      teamWrs: Object.fromEntries([...teamWrs.entries()].map(([k, v]) => [k, v])),
      topComps: sortedComps.slice(0, 30).map(cr => ({
        comp: cr.comp, wr: winRate(cr.agg), samples: cr.agg.samples,
        avgRoundsPlayed: cr.agg.avgRoundsPlayed,
      })),
      bottomComps: sortedComps.slice(-30).map(cr => ({
        comp: cr.comp, wr: winRate(cr.agg), samples: cr.agg.samples,
        avgRoundsPlayed: cr.agg.avgRoundsPlayed,
      })),
    }, null, 2),
  };
}

// ---------------------------------------------------------------------------
// Bench multi-round
// ---------------------------------------------------------------------------

function benchMultiRound(): void {
  const BENCH_ITERS = 1000;
  const matchups = [
    { label: 'Mouse swarm', a: ['mouse','mouse','mouse'], b: ['mouse','mouse','mouse'] },
    { label: 'Elephant brawl', a: ['elephant','elephant','elephant'], b: ['elephant','elephant','elephant'] },
    { label: 'Mixed comp', a: ['bear','mouse','skunk'], b: ['rhino','cat','dragon'] },
    { label: 'Big slow', a: ['whale','elephant','turtle'], b: ['whale','rhino','bear'] },
  ];
  console.log(`\nMulti-round bench: ${BENCH_ITERS} matches × ${matchups.length} matchups = ${BENCH_ITERS * matchups.length} total matches`);
  let totalMatches = 0;
  const totalStart = performance.now();
  for (const m of matchups) {
    const start = performance.now();
    let reasons = { paint_threshold: 0, round_cap: 0, stall: 0 };
    for (let i = 0; i < BENCH_ITERS; i++) {
      const r = runMultiRoundMatch(
        { petIds: m.a }, { petIds: m.b },
        { maxRounds: MAX_ROUNDS, execSeconds: EXEC_SECONDS, startEnergy: START_ENERGY, seed: i },
      );
      reasons[r.reason]++;
    }
    const elapsed = (performance.now() - start) / 1000;
    const perSec = BENCH_ITERS / elapsed;
    console.log(`  ${m.label}: ${perSec.toFixed(0)} matches/sec | paint=${reasons.paint_threshold}, round_cap=${reasons.round_cap}, stall=${reasons.stall}`);
    totalMatches += BENCH_ITERS;
  }
  const totalElapsed = (performance.now() - totalStart) / 1000;
  const overall = totalMatches / totalElapsed;
  console.log(`  Overall: ${overall.toFixed(0)} matches/sec`);
  const sweepEst = (comps.length * TEAM_OPPONENTS * TEAM_SAMPLES) / overall;
  console.log(`  Est full sweep time: ${sweepEst.toFixed(0)}s (${(sweepEst / 60).toFixed(1)} min)\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const comps = enumerateComps();

async function main() {
  console.log(`Enumerated ${comps.length} comps (expected 455).`);
  benchMultiRound();

  const t0 = Date.now();
  const results = runTeamSweep(comps);
  const teamWrs = computeTeamWr(results);
  const matchStats = computeMatchLengthStats(results);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nSweep wall time: ${elapsed}s`);
  console.log(`Matches/sec: ${((comps.length * TEAM_OPPONENTS * TEAM_SAMPLES) / parseFloat(elapsed)).toFixed(0)}`);

  const { md, json } = writeReport(comps, results, teamWrs, matchStats);

  const dir = join(process.cwd(), 'docs', 'balance-reports');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  const mdPath = join(dir, `report-multiround-${stamp}.md`);
  const jsonPath = join(dir, `report-multiround-${stamp}.json`);
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, json);
  console.log(`\nWrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);

  // Quick summary to stdout
  const sortedPets = [...teamWrs.values()].sort((a, b) => b.teamWr - a.teamWr);
  console.log('\nTop 3 pets:');
  for (const p of sortedPets.slice(0, 3)) {
    const def = ALL_PETS.find(d => d.id === p.petId)!;
    console.log(`  ${def.emoji} ${def.displayName}: ${(p.teamWr * 100).toFixed(1)}%`);
  }
  console.log('Bottom 3 pets:');
  for (const p of sortedPets.slice(-3).reverse()) {
    const def = ALL_PETS.find(d => d.id === p.petId)!;
    console.log(`  ${def.emoji} ${def.displayName}: ${(p.teamWr * 100).toFixed(1)}%`);
  }
  console.log(`\nMatch stats: avg ${matchStats.avgRoundsPlayed.toFixed(2)} rounds, ${matchStats.avgTicksPerMatch.toFixed(0)} ticks. Paint: ${matchStats.pctPaint.toFixed(1)}%, round-cap: ${matchStats.pctRoundCap.toFixed(1)}%, stall: ${matchStats.pctStall.toFixed(1)}%`);
}

main().catch((e) => { console.error(e); process.exit(1); });
