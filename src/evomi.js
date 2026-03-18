/**
 * evomi.js
 *
 * Fetches current remaining balance from the Evomi REST API.
 *
 * Endpoint: GET https://api.evomi.com/public
 * Auth:     x-apikey header
 * Docs:     https://docs.evomi.com/public-api/
 *
 * Response shape:
 *  {
 *    success: true,
 *    products: {
 *      rp:  { balance_mb: number, ... },
 *      rpc: { balance_mb: number, ... },
 *      mp:  { balance_mb: number, ... },
 *      ...
 *    }
 *  }
 *
 * Returns total remaining balance in GB (sum of all products' balance_mb).
 */

'use strict';

const axios = require('axios');

/**
 * Fetch total remaining bandwidth balance in GB.
 * Sums balance_mb across all products, then converts MB → GB.
 *
 * @returns {Promise<number>} remaining balance in GB, e.g. 133.7
 */
async function fetchBalance() {
  const apiKey = process.env.EVOMI_API_KEY;
  if (!apiKey) throw new Error('EVOMI_API_KEY environment variable is not set.');

  const { data } = await axios.get('https://api.evomi.com/public', {
    headers: { 'x-apikey': apiKey },
    timeout: 15_000,
  });

  if (!data.success) {
    throw new Error(`Evomi API returned success=false: ${JSON.stringify(data)}`);
  }

  // products is a keyed object: { rp: {...}, rpc: {...}, mp: {...}, ... }
  // Sum balance_mb across all product entries that have the field.
  const totalMB = Object.values(data.products)
    .filter((p) => typeof p === 'object' && p !== null && 'balance_mb' in p)
    .reduce((sum, p) => sum + (parseFloat(p.balance_mb) || 0), 0);

  return totalMB / 1024; // MB → GB
}

module.exports = { fetchBalance };
