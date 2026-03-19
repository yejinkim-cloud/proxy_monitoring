/**
 * format.js
 *
 * Pure formatting — no I/O, no side effects.
 *
 * Normal:
 *   *[3월 18일 15시 Proxy 모니터링 알림]*
 *
 *   :battery: 현재 잔량
 *   132.5 GB 남았습니다.
 *
 *   :money_with_wings: Last 6 Hours Usage
 *   09시 00분 ~ 15시 00분  총 6시간 0분 동안 2.3GB를 사용했습니다.
 *
 * Low balance (< 50 GB) — warning line added after balance:
 *   :bangbang: Proxy 용량이 얼마 남지 않았습니다. 충전해주세요.
 *
 * First run (no previous state):
 *   :money_with_wings: Last 6 Hours Usage
 *   N/A (first run)
 */

'use strict';

const LOW_BALANCE_THRESHOLD_GB = 50;
const CRITICAL_BALANCE_THRESHOLD_GB = 10;
const TOTAL_CAPACITY_GB = 500;

const BAR_LENGTH = 10; // number of segments in the progress bar

/**
 * Format a GB value to 1 decimal place, minimum 0.
 * @param {number} gb
 * @returns {string} e.g. "132.5"
 */
function formatGB(gb) {
  return Math.max(0, gb).toFixed(1);
}

/**
 * Convert a Date to Korean time parts in Asia/Seoul timezone.
 * @param {Date} date
 * @returns {{ month: number, day: number, hour: number, minute: number }}
 */
function toSeoulParts(date) {
  // Use Intl.DateTimeFormat for reliable timezone conversion
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10) % 24, // guard against "24" returned by some engines
    minute: parseInt(parts.minute, 10),
  };
}

/**
 * Format a Date as "HH시 MM분" in Asia/Seoul.
 * e.g. "9시 00분", "17시 02분"
 * @param {Date} date
 * @returns {string}
 */
function formatSeoulTime(date) {
  const { hour, minute } = toSeoulParts(date);
  return `${hour}시 ${String(minute).padStart(2, '0')}분`;
}

/**
 * Format a duration in minutes as "H시간 M분" or "M분".
 * @param {number} totalMinutes
 * @returns {string}
 */
function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

/**
 * Build the Korean date/time header in bold Slack markdown.
 * e.g. "*[3월 18일 15시 Proxy 모니터링 알림]*"
 * @param {Date} now
 * @returns {string}
 */
function buildHeader(now) {
  const { month, day, hour } = toSeoulParts(now);
  return `*[${month}월 ${day}일 ${hour}시 Proxy 모니터링 알림]*`;
}

/**
 * Build the Slack plain-text message.
 *
 * @param {object} params
 * @param {number}      params.currentBalanceGB  - current remaining balance in GB
 * @param {number|null} params.usageGB           - GB consumed since last run (null = first run)
 * @param {Date|null}   params.prevDate          - timestamp of the previous snapshot (null = first run)
 * @param {Date}        [params.now]             - current time (default: new Date())
 * @returns {string}
 */
function buildMessage({ currentBalanceGB, usageGB, prevDate, now = new Date() }) {
  const isCriticalBalance = currentBalanceGB < CRITICAL_BALANCE_THRESHOLD_GB;
  const isLowBalance = currentBalanceGB < LOW_BALANCE_THRESHOLD_GB;

  // ── Usage line ────────────────────────────────────────────────────────────
  let usageDetail;
  if (usageGB === null || prevDate === null) {
    usageDetail = 'N/A (first run)';
  } else {
    const fromLabel = formatSeoulTime(prevDate);
    const toLabel = formatSeoulTime(now);
    const diffMinutes = (now - prevDate) / 60_000;
    const duration = formatDuration(diffMinutes);
    usageDetail = `${fromLabel} ~ ${toLabel}  총 ${duration} 동안 ${formatGB(usageGB)}GB를 사용했습니다.`;
  }

  // Progress bar: █ for used, ░ for remaining (10 segments total)
  const remainRatio = Math.min(1, Math.max(0, currentBalanceGB / TOTAL_CAPACITY_GB));
  const filledCount = Math.round(remainRatio * BAR_LENGTH);
  const bar = '█'.repeat(filledCount) + '░'.repeat(BAR_LENGTH - filledCount);
  const pct = (remainRatio * 100).toFixed(1);
  const progressBar = `${bar} ${pct}%\n${formatGB(currentBalanceGB)} / ${TOTAL_CAPACITY_GB} GB`;

  const lines = [
    buildHeader(now),
    '',
    ':battery: 현재 잔량',
    `${formatGB(currentBalanceGB)} GB 남았습니다.`,
    progressBar,
  ];

  if (isCriticalBalance) {
    lines.push(':bangbang::bangbang: Proxy 용량이 매우 부족합니다. 즉시 충전해주세요. <!here>');
  } else if (isLowBalance) {
    lines.push(':bangbang: Proxy 용량이 얼마 남지 않았습니다. 충전해주세요.');
  }

  lines.push('');
  lines.push(':money_with_wings: Last 6 Hours Usage');
  lines.push(usageDetail);

  return lines.join('\n');
}

module.exports = { buildMessage, LOW_BALANCE_THRESHOLD_GB };
