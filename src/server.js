/**
 * server.js
 *
 * Two responsibilities:
 *  1. Built-in cron scheduler — fires at 09:00 / 15:00 / 21:00 Asia/Seoul
 *     (more reliable than GitHub Actions' scheduled cron)
 *  2. Slack slash command (/evomi-monitor) for on-demand queries
 *
 * Usage:
 *   node src/server.js    (or: npm start / npm run server)
 */

'use strict';

require('dotenv').config();

const cron = require('node-cron');
const { App, ExpressReceiver } = require('@slack/bolt');
const { run: runMonitor } = require('./index');
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

// ── Cron scheduler (Asia/Seoul) ──────────────────────────────────────────────
// Runs at 09:00, 15:00, 21:00 KST every day.
// node-cron handles the timezone natively — no UTC conversion needed.
const CRON_SCHEDULE = '0 9,15,21 * * *';

cron.schedule(CRON_SCHEDULE, async () => {
  console.log('[cron] Scheduled monitor triggered');
  try {
    await runMonitor();
  } catch (err) {
    console.error('[cron] Monitor run failed:', err.message);
  }
}, { timezone: 'Asia/Seoul' });

console.log(`[cron] Scheduled at ${CRON_SCHEDULE} Asia/Seoul (09:00 / 15:00 / 21:00 KST)`);

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
