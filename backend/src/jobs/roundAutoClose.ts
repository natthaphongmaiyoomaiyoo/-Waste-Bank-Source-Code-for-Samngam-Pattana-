import { closeEndedRounds } from '../services/committeeRoundService.js';

// Closes collection rounds once their time window is over
// (committeeRoundService.closeEndedRounds): once when the server starts, which
// catches up on anything that ended while it was down, then every minute.
// Started from server.ts only, so tests that import the app run no timer.

const INTERVAL_MS = 60_000;

let running = false;

async function tick() {
  // A slow database must not stack runs on top of each other.
  if (running) return;
  running = true;
  try {
    const closed = await closeEndedRounds();
    if (closed > 0) console.log(`[round-auto-close] closed ${closed} round(s) whose time had passed`);
  } catch (error) {
    // Keep the server up; the next tick tries again.
    console.error('[round-auto-close] failed:', error);
  } finally {
    running = false;
  }
}

export function startRoundAutoClose() {
  void tick();
  // unref: the timer alone must never keep the process alive.
  setInterval(() => void tick(), INTERVAL_MS).unref();
}
