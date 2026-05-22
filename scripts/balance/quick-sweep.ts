/**
 * quick-sweep.ts — focused ~30-second validation for a single pet.
 *
 * Usage:  npm run balance:quick <petId>
 * Example: npm run balance:quick elephant
 *
 * Finds the latest balance report, extracts the top-20 meta comps as opponents,
 * then runs every comp containing the target pet against each of those opponents.
 * Writes a markdown report to docs/balance-reports/quick-<petId>-<timestamp>.md
 */

import { ALL_PETS } from '../../src/sim/pets';
import { runHeadlessMatch } from './sim';
import { WIN_PAINT_THRESHOLD } from '../../src/config/balance';
import { BOARD_SIZE } from '../../src/config/constants';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ENERGY_BUDGET = 20;
const MAX_SECONDS = 60;
const WIN_THRESHOLD = WIN_PAINT_THRESHOLD;
const WIN_PCT = Math.round((WIN_THRESHOLD / (BOARD_SIZE * BOARD_SIZE)) * 100);
const SAMPLES_PER_MATCHUP = 6;  // 3 each side — bias-cancelled

// ---------------------------------------------------------------------------
// Comp enumeration (shared logic with runner.ts)
// ---------------------------------------------------------------------------

type CompDef = string[];

function enumerateComps(): CompDef[] {
  const comps: CompDef[] = [];
  const ids = ALL_PETS.map(p => p.id);

  // 3-of-one
  for (const x of ids) {
    comps.push([x, x, x]);
  }

  // 2:1 — ordered pair (X, Y) where X != Y
  for (const x of ids) {
    for (const y of ids) {
      if (y === x) continue;
      comps.push([x, x, y]);
    }
  }

  // 1:1:1 — unordered triple of distinct pets (canonical alphabetical order)
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
// Load latest report JSON
// ---------------------------------------------------------------------------

interface ReportJson {
  metaPool: Array<{ comp: string[]; wr: number; isTop20: boolean; isCounter20: boolean }>;
  topComps: Array<{ comp: string[]; wr: number; samples: number }>;
}

function loadLatestReport(dir: string): ReportJson {
  const files = readdirSync(dir)
    .filter(f => f.match(/^report-.*-60pct\.json$/))
    .sort();  // ISO timestamp sorts lexicographically
  if (files.length === 0) throw new Error(`No report-*-60pct.json found in ${dir}`);
  const path = join(dir, files[files.length - 1]);
  console.log(`Using report: ${files[files.length - 1]}`);
  return JSON.parse(readFileSync(path, 'utf-8')) as ReportJson;
}

// ---------------------------------------------------------------------------
// Match result helpers (mirrors runner.ts)
// ---------------------------------------------------------------------------

interface Aggregate {
  winsA: number; winsB: number; draws: number;
  avgScoreA: number; avgScoreB: number;
  samples: number;
}

function emptyAgg(): Aggregate {
  return { winsA: 0, winsB: 0, draws: 0, avgScoreA: 0, avgScoreB: 0, samples: 0 };
}

function addResult(agg: Aggregate, winner: 'A' | 'B' | 'draw', sA: number, sB: number): void {
  agg.samples++;
  if (winner === 'A') agg.winsA++;
  else if (winner === 'B') agg.winsB++;
  else agg.draws++;
  agg.avgScoreA += sA;
  agg.avgScoreB += sB;
}

function finalizeAgg(agg: Aggregate): Aggregate {
  if (agg.samples === 0) return agg;
  return { ...agg, avgScoreA: agg.avgScoreA / agg.samples, avgScoreB: agg.avgScoreB / agg.samples };
}

function winRate(agg: Aggregate): number {
  if (agg.samples === 0) return 0.5;
  return (agg.winsA + agg.draws * 0.5) / agg.samples;
}

// ---------------------------------------------------------------------------
// Core sweep
// ---------------------------------------------------------------------------

interface CompSweepResult {
  comp: CompDef;
  agg: Aggregate;
  priorWr: number | null;  // WR from the loaded report, if this exact comp appeared
}

function runQuickSweep(
  petComps: CompDef[],
  metaOpponents: CompDef[],
  priorWrMap: Map<string, number>,
): CompSweepResult[] {
  const totalMatches = petComps.length * metaOpponents.length * SAMPLES_PER_MATCHUP;
  console.log(`Sweeping ${petComps.length} comps × ${metaOpponents.length} meta opponents × ${SAMPLES_PER_MATCHUP} samples = ${totalMatches} matches...`);

  const results: CompSweepResult[] = petComps.map(comp => ({
    comp,
    agg: emptyAgg(),
    priorWr: priorWrMap.get(comp.slice().sort().join('|')) ?? null,
  }));

  let matchSeed = 2_000_000;
  const halfA = Math.floor(SAMPLES_PER_MATCHUP / 2);
  const halfB = SAMPLES_PER_MATCHUP - halfA;

  for (let ci = 0; ci < petComps.length; ci++) {
    const comp = petComps[ci];

    for (const opp of metaOpponents) {
      // Side-A samples: comp = side A
      for (let s = 0; s < halfA; s++) {
        const r = runHeadlessMatch(
          { petIds: comp },
          { petIds: opp },
          { energyBudget: ENERGY_BUDGET, winThreshold: WIN_THRESHOLD, maxSeconds: MAX_SECONDS, seed: matchSeed++ },
        );
        addResult(results[ci].agg, r.winner, r.scoreA, r.scoreB);
      }

      // Side-B samples: comp = side B (reframe to comp's perspective)
      for (let s = 0; s < halfB; s++) {
        const raw = runHeadlessMatch(
          { petIds: opp },
          { petIds: comp },
          { energyBudget: ENERGY_BUDGET, winThreshold: WIN_THRESHOLD, maxSeconds: MAX_SECONDS, seed: matchSeed++ },
        );
        const w = raw.winner === 'A' ? 'B' as const : raw.winner === 'B' ? 'A' as const : 'draw' as const;
        addResult(results[ci].agg, w, raw.scoreB, raw.scoreA);
      }
    }

    results[ci].agg = finalizeAgg(results[ci].agg);

    if ((ci + 1) % 20 === 0 || ci + 1 === petComps.length) {
      process.stdout.write(`  comp ${ci + 1}/${petComps.length}\r`);
    }
  }
  process.stdout.write('\n');
  return results;
}

// ---------------------------------------------------------------------------
// Report writing
// ---------------------------------------------------------------------------

function writeReport(
  petId: string,
  results: CompSweepResult[],
  metaOpponents: CompDef[],
  wallTimeSec: number,
): string {
  const sorted = [...results].sort((a, b) => winRate(b.agg) - winRate(a.agg));

  // Count comps in top-20 of THIS focused sweep (by WR ranking within the sweep)
  const top20InSweep = sorted.slice(0, 20);
  const compsWith50Plus = sorted.filter(r => winRate(r.agg) >= 0.50);
  const compsWith55Plus = sorted.filter(r => winRate(r.agg) >= 0.55);
  const compsWith60Plus = sorted.filter(r => winRate(r.agg) >= 0.60);

  const petDef = ALL_PETS.find(p => p.id === petId)!;

  const lines: string[] = [];
  lines.push(`# Quick Sweep — ${petDef.emoji} ${petDef.displayName}`);
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Wall time:** ${wallTimeSec.toFixed(1)}s`);
  lines.push(`**Config:** energy ${ENERGY_BUDGET}, match cap ${MAX_SECONDS}s, win ${WIN_THRESHOLD} tiles (${WIN_PCT}%).`);
  lines.push(`**Method:** ${results.length} comps containing ${petId} × ${metaOpponents.length} top-20 meta opponents × ${SAMPLES_PER_MATCHUP} samples (${Math.floor(SAMPLES_PER_MATCHUP / 2)} each side) = ${results.length * metaOpponents.length * SAMPLES_PER_MATCHUP} matches.`);
  lines.push('');

  // Verdict
  lines.push(`## Verdict`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Comps ≥ 60% WR vs meta | ${compsWith60Plus.length} |`);
  lines.push(`| Comps ≥ 55% WR vs meta | ${compsWith55Plus.length} |`);
  lines.push(`| Comps ≥ 50% WR vs meta | ${compsWith50Plus.length} |`);
  lines.push(`| Best comp WR | ${(winRate(sorted[0].agg) * 100).toFixed(1)}% |`);
  lines.push(`| Worst comp WR | ${(winRate(sorted[sorted.length - 1].agg) * 100).toFixed(1)}% |`);
  lines.push('');

  const verdict4Plus = compsWith60Plus.length >= 4;
  if (verdict4Plus) {
    lines.push(`**VERDICT: PASS** — ${petId} has ${compsWith60Plus.length} comps at ≥ 60% WR vs the top-20 meta. Recommend running full balance sweep to confirm.`);
  } else {
    const suggestion = compsWith55Plus.length >= 4
      ? `${petId} is close (${compsWith55Plus.length} comps at ≥ 55% WR) — try bumping stompDamage to 7 or reducing stompIntervalSec to 0.5.`
      : `${petId} still underperforming (only ${compsWith50Plus.length} comps at ≥ 50% WR) — consider a more significant mechanic change.`;
    lines.push(`**VERDICT: FAIL** — ${petId} only has ${compsWith60Plus.length} comps at ≥ 60% WR vs the top-20 meta (need 4+). ${suggestion}`);
  }
  lines.push('');

  // Top 20 comps in this sweep
  lines.push(`## Top 20 comps containing ${petId} (vs meta opponents)`);
  lines.push('');
  lines.push(`| Rank | Comp | WR vs Meta | Prior WR | Delta | Samples |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (let i = 0; i < Math.min(20, sorted.length); i++) {
    const r = sorted[i];
    const wr = winRate(r.agg);
    const emojis = r.comp.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const ids = r.comp.join('+');
    const priorStr = r.priorWr !== null ? `${(r.priorWr * 100).toFixed(1)}%` : 'no prior';
    const delta = r.priorWr !== null
      ? ((wr - r.priorWr) >= 0 ? `+${((wr - r.priorWr) * 100).toFixed(1)}%` : `${((wr - r.priorWr) * 100).toFixed(1)}%`)
      : '—';
    lines.push(`| ${i + 1} | ${emojis} (${ids}) | ${(wr * 100).toFixed(1)}% | ${priorStr} | ${delta} | ${r.agg.samples} |`);
  }
  lines.push('');

  // Bottom comps
  lines.push(`## Bottom 10 comps containing ${petId}`);
  lines.push('');
  lines.push(`| Rank | Comp | WR vs Meta | Samples |`);
  lines.push(`|---|---|---|---|`);
  for (let i = sorted.length - 1; i >= Math.max(0, sorted.length - 10); i--) {
    const r = sorted[i];
    const wr = winRate(r.agg);
    const emojis = r.comp.map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const ids = r.comp.join('+');
    lines.push(`| ${sorted.length - i} from bottom | ${emojis} (${ids}) | ${(wr * 100).toFixed(1)}% | ${r.agg.samples} |`);
  }
  lines.push('');

  // Meta opponents used
  lines.push(`## Meta opponents used (top-20 from latest report)`);
  lines.push('');
  lines.push(`| # | Comp |`);
  lines.push(`|---|---|`);
  for (let i = 0; i < metaOpponents.length; i++) {
    const emojis = metaOpponents[i].map(id => ALL_PETS.find(d => d.id === id)!.emoji).join('+');
    const ids = metaOpponents[i].join('+');
    lines.push(`| ${i + 1} | ${emojis} (${ids}) |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const petId = process.argv[2];
  if (!petId) {
    console.error('Usage: npm run balance:quick <petId>');
    console.error('Example: npm run balance:quick elephant');
    process.exit(1);
  }

  const petDef = ALL_PETS.find(p => p.id === petId);
  if (!petDef) {
    console.error(`Unknown pet: ${petId}`);
    console.error(`Valid pet IDs: ${ALL_PETS.map(p => p.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`Quick sweep for: ${petDef.emoji} ${petDef.displayName}`);

  // Load latest report
  const reportsDir = join(process.cwd(), 'docs', 'balance-reports');
  const report = loadLatestReport(reportsDir);

  // Extract top-20 meta comps from the report
  const metaOpponents: CompDef[] = report.metaPool
    .filter(m => m.isTop20)
    .map(m => m.comp);
  console.log(`Loaded ${metaOpponents.length} top-20 meta opponents.`);

  // Build prior WR map: canonical key (sorted, pipe-joined) -> WR
  // Use topComps from the report (sorted by WR, first 30 stored)
  const priorWrMap = new Map<string, number>();
  for (const tc of report.topComps) {
    priorWrMap.set(tc.comp.slice().sort().join('|'), tc.wr);
  }

  // Enumerate all comps containing the target pet
  const allComps = enumerateComps();
  const petComps = allComps.filter(c => c.includes(petId));
  console.log(`Found ${petComps.length} comps containing ${petId} (expected ~91).`);

  // Run the sweep
  const t0 = Date.now();
  const results = runQuickSweep(petComps, metaOpponents, priorWrMap);
  const wallTimeSec = (Date.now() - t0) / 1000;
  console.log(`Wall time: ${wallTimeSec.toFixed(1)}s`);

  // Write report
  const md = writeReport(petId, results, metaOpponents, wallTimeSec);
  mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  const outPath = join(reportsDir, `quick-${petId}-${stamp}.md`);
  writeFileSync(outPath, md);
  console.log(`\nWrote ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
