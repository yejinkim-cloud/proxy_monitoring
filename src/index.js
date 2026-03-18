/**
 * index.js
 *
 * Entry point for one scheduled monitor run.
 *
 * Flow:
 *  1. Read previous state (balance snapshot from the last run)
 *  2. Fetch current balance from Evomi API
 *  3. Calculate 6-hour usage = prevBalance - currentBalance
 *  4. Format and send Slack message
 *  5. Save current balance as new state (for the next run)
 *
 * Usage:
 *   node src/index.js     (or: npm run monitor)
 */

'use strict';

require('dotenv').config();

const { fetchBalance } = require('./evomi');
const { readState, writeState } = require('./state');
const { buildMessage } = require('./format');
const { sendWebhook } = require('./slack');

async function run() {
  console.log('[index] Starting Evomi proxy monitor...');

  // ── 1. Read previous snapshot ────────────────────────────────────────────
  const prev = readState();
  if (prev) {
    console.log(`[index] Previous state: ${prev.balanceGB.toFixed(2)} GB at ${prev.seoulTime} KST (${prev.timestamp})`);
  } else {
    console.log('[index] No previous state found — this is the first run.');
  }

  // ── 2. Fetch current balance ─────────────────────────────────────────────
  let currentBalanceGB;
  try {
    currentBalanceGB = await fetchBalance();
    console.log(`[index] Current balance: ${currentBalanceGB.toFixed(2)} GB`);
  } catch (err) {
    console.error('[index] Failed to fetch balance from Evomi API — aborting.');
    console.error(err.message);
    process.exit(1);
  }

  // ── 3. Compute usage and timestamps ─────────────────────────────────────
  const now = new Date();
  const prevDate = prev ? new Date(prev.timestamp) : null;
  const usageGB = prev !== null ? prev.balanceGB - currentBalanceGB : null;
  if (usageGB !== null) {
    console.log(`[index] 6-hour usage: ${usageGB.toFixed(2)} GB`);
  }

  // ── 4. Format and send ───────────────────────────────────────────────────
  const message = buildMessage({ currentBalanceGB, usageGB, prevDate, now });

  console.log('[index] Message:\n' + message);

  try {
    await sendWebhook(message);
  } catch (err) {
    console.error('[index] Failed to send Slack message.');
    console.error(err.message);
    process.exit(1);
  }

  // ── 6. Save current state for the next run ───────────────────────────────
  writeState(currentBalanceGB);
  console.log('[index] State saved. Done.');
}

run();
