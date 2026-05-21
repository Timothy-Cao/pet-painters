// Tiny rolling event log surfaced in the tactical sidebar. Holds at most
// MAX_EVENTS entries; oldest are evicted. UI reads from `getRecentEvents`
// and renders the most-recent first.
//
// Lives in `src/ui/` rather than `src/render/` because consumers display it
// in the DOM, not on the canvas — but the sim is allowed to push events the
// same way it pushes visual effects.

const MAX_EVENTS = 6;
const MAX_AGE_MS = 10_000;

export interface LogEvent {
  emoji: string;
  text: string;
  at: number;
}

const events: LogEvent[] = [];

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function pushEvent(emoji: string, text: string): void {
  events.push({ emoji, text, at: now() });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

export function getRecentEvents(): LogEvent[] {
  const t = now();
  return events
    .filter((e) => t - e.at <= MAX_AGE_MS)
    .slice()
    .reverse();
}

export function clearEvents(): void {
  events.length = 0;
}
