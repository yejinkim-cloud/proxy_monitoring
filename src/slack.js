/**
 * slack.js
 *
 * Two Slack integration modes:
 *
 *  1. sendWebhook(text)
 *     Posts a plain-text message to the configured Incoming Webhook URL.
 *     Used by the scheduled monitor (src/index.js).
 *
 *  2. respondToSlashCommand(respond, text)
 *     Sends a plain-text ephemeral response back to a Slack slash command.
 *     Used by the Express server (src/server.js) via @slack/bolt.
 */

'use strict';

const { IncomingWebhook } = require('@slack/webhook');

/**
 * Post a plain-text message to Slack via Incoming Webhook.
 *
 * @param {string} text  - the message to send
 * @returns {Promise<void>}
 */
async function sendWebhook(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error('SLACK_WEBHOOK_URL environment variable is not set.');

  const webhook = new IncomingWebhook(url);

  // Block Kit is intentionally NOT used; send raw text only.
  await webhook.send({ text });
  console.log('[slack] Message sent via webhook.');
}

/**
 * Respond to a Slack slash command with a plain-text message.
 * This uses the `respond` helper provided by @slack/bolt.
 *
 * @param {Function} respond  - Bolt's respond() helper from the slash command handler
 * @param {string}   text     - the message to send
 * @returns {Promise<void>}
 */
async function respondToSlashCommand(respond, text) {
  // response_type: 'in_channel' makes the reply visible to the whole channel.
  // Use 'ephemeral' if you want only the invoking user to see it.
  await respond({ response_type: 'in_channel', text });
  console.log('[slack] Slash command response sent.');
}

module.exports = { sendWebhook, respondToSlashCommand };
