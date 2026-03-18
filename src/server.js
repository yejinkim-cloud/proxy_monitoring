/**
 * server.js
 *
 * Slack slash command server for on-demand monitoring.
 *
 * When /evomi-monitor is typed in Slack:
 *  1. Reads the saved state (previous balance snapshot)
 *  2. Fetches current balance from Evomi API
 *  3. Calculates usage since last scheduled run
 *  4. Responds with the same formatted message as the scheduled monitor
 *
 * Usage:
 *   node src/server.js    (or: npm start / npm run server)
 */

'use strict';

require('dotenv').config();

const { App, ExpressReceiver } = require('@slack/bolt');
const { fetchBalance } = require('./evomi');
const { readState, writeState } = require('./state');
const { buildMessage } = require('./format');

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// ── /evomi-monitor slash command ─────────────────────────────────────────────

app.command('/evomi-monitor', async ({ ack, respond, command }) => {
  // Acknowledge within Slack's 3-second window immediately
  await ack();

  console.log(`[server] /evomi-monitor by @${command.user_name}`);

  try {
    const prev = readState();
    const currentBalanceGB = await fetchBalance();
    const now = new Date();
    const prevDate = prev ? new Date(prev.timestamp) : null;
    const usageGB = prev !== null ? prev.balanceGB - currentBalanceGB : null;

    const message = buildMessage({ currentBalanceGB, usageGB, prevDate, now });

    // Update state so this manual query counts as a new snapshot baseline
    writeState(currentBalanceGB);

    await respond({ response_type: 'in_channel', text: message });
  } catch (err) {
    console.error('[server] /evomi-monitor failed:', err.message);
    await respond({
      response_type: 'ephemeral',
      text: ':warning: Failed to fetch Evomi data. Please try again later.',
    });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────

receiver.router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);

(async () => {
  await app.start(PORT);
  console.log(`[server] Listening on port ${PORT} — POST /slack/events`);
})();
