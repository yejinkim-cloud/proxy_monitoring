/**
 * state.js
 *
 * Persists the balance snapshot from each monitor run so that the next run
 * can compute "last 6 hours usage = previous balance - current balance".
 *
 * Storage: data/state.json  (relative to the project root)
 *
 * In GitHub Actions, this file is preserved between runs using actions/cache.
 * Locally, it accumulates naturally across manual runs.
 *
 * State file shape:
 *  {
 *    "balanceGB": 133.7,
 *    "timestamp": "2026-03-18T00:00:00.000Z",   // ISO 8601 UTC
 *    "seoulTime": "09:00"                        // KST label for display
 *  }
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', 'data', 'state.json');

/**
 * Read the previous state snapshot.
 * Returns null if no state file exists yet (first run).
 *
 * @returns {{ balanceGB: number, timestamp: string, seoulTime: string } | null}
 */
function readState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null; // file doesn't exist or is corrupt — treat as first run
  }
}

/**
 * Write the current balance snapshot to the state file.
 *
 * @param {number} balanceGB   - current balance in GB
 */
function writeState(balanceGB) {
  const now = new Date();

  // Formatted Seoul time for display (HH:MM)
  const seoulTime = now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const state = {
    balanceGB,
    timestamp: now.toISOString(),
    seoulTime,
  };

  // Ensure the data/ directory exists
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

module.exports = { readState, writeState };
