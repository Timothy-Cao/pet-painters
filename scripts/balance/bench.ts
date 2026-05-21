/**
 * Quick benchmark: how many headless matches per second does the current sim run?
 */
import { runHeadlessMatch } from './sim';
import { ALL_PETS } from '../../src/sim/pets';

const ITERATIONS = 1000;

// Pick a few representative matchups
const matchups: Array<{ label: string; a: string[]; b: string[] }> = [
  { label: 'Mouse swarm (cheap, lots of pets)', a: ['mouse','mouse','mouse'], b: ['mouse','mouse','mouse'] },
  { label: 'Elephant brawl (expensive, few pets)', a: ['elephant','elephant','elephant'], b: ['elephant','elephant','elephant'] },
  { label: 'Mixed comp (typical)',                a: ['bear','mouse','skunk'], b: ['rhino','cat','dragon'] },
  { label: 'Big slow (3x3 whale + tanks)',        a: ['whale','elephant','turtle'], b: ['whale','rhino','bear'] },
];

console.log(`Bench: ${ITERATIONS} matches × ${matchups.length} matchups = ${ITERATIONS * matchups.length} total matches`);
console.log(`Pet roster size: ${ALL_PETS.length}\n`);

let totalTicks = 0;
let totalMatches = 0;
const totalStart = performance.now();

for (const m of matchups) {
  const start = performance.now();
  let endByReason = { paint_threshold: 0, stall: 0, timeout: 0 };
  let ticks = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const r = runHeadlessMatch(
      { petIds: m.a },
      { petIds: m.b },
      { energyBudget: 20, maxSeconds: 30, seed: i },
    );
    endByReason[r.reason]++;
    ticks += r.ticks;
  }
  const elapsed = (performance.now() - start) / 1000;
  const perSec = ITERATIONS / elapsed;
  const avgTicks = ticks / ITERATIONS;
  console.log(`  ${m.label}`);
  console.log(`    ${ITERATIONS} matches in ${elapsed.toFixed(2)}s → ${perSec.toFixed(0)} matches/sec, avg ${avgTicks.toFixed(0)} ticks/match`);
  console.log(`    end reasons: paint=${endByReason.paint_threshold}, stall=${endByReason.stall}, timeout=${endByReason.timeout}`);
  totalTicks += ticks;
  totalMatches += ITERATIONS;
}

const totalElapsed = (performance.now() - totalStart) / 1000;
const overallPerSec = totalMatches / totalElapsed;
const avgMatchTicks = totalTicks / totalMatches;
console.log(`\nTotal: ${totalMatches} matches in ${totalElapsed.toFixed(2)}s`);
console.log(`Overall: ${overallPerSec.toFixed(0)} matches/sec`);
console.log(`Average match length: ${avgMatchTicks.toFixed(0)} ticks (${(avgMatchTicks / 20).toFixed(1)} game-seconds)`);
console.log(`Per-tick rate: ${(totalTicks / totalElapsed).toFixed(0)} ticks/sec`);
console.log(`\nFor reference: a full team-comp sweep is 113,750 matches → est ${(113750 / overallPerSec).toFixed(0)}s wall time.`);
