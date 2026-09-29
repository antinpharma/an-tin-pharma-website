import {createHash} from 'node:crypto';

export function sourceTime(values, now = new Date()) {
  const raw = typeof values?.[0]?.[0] === 'string' ? values[0][0].trim() : '';
  const match = /^Update:\s*(\d{1,2})h(?:(\d{2}))?\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/i.exec(raw);
  if (!match) return {sourceUpdatedAt: null, sourceLabel: null, freshness: 'unknown'};
  const [, hour, minute = '0', day, month, explicitYear] = match;
  const vietnamNow = new Date(now.getTime() + 7 * 3600000);
  let year = explicitYear ? Number(explicitYear) : vietnamNow.getUTCFullYear();
  if (!explicitYear && vietnamNow.getUTCMonth() === 0 && Number(month) === 12) year--;
  const local = new Date(Date.UTC(year, Number(month) - 1, Number(day), Number(hour), Number(minute)));
  if (local.getUTCFullYear() !== year || local.getUTCMonth() + 1 !== Number(month) ||
      local.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59) {
    return {sourceUpdatedAt: null, sourceLabel: null, freshness: 'unknown'};
  }
  const date = new Date(local.getTime() - 7 * 3600000);
  const age = (now - date) / 3600000;
  return {sourceUpdatedAt: date.toISOString(), sourceLabel: raw,
    freshness: age < -1 ? 'future' : age > 36 ? 'stale' : 'fresh'};
}

export function buildAudit(before, result, values, catalogue, now = new Date(), previous = {}) {
  const old = new Map(before.map(product => [String(product.productId), product]));
  return {version: 1, status: 'checked', checkedAt: now.toISOString(), ...sourceTime(values, now),
    lastChangedAt: result.changes.length ? now.toISOString() : previous.lastChangedAt || null,
    catalogueSha256: createHash('sha256').update(catalogue).digest('hex'),
    total: result.products.length, changed: result.changes.length, added: result.added,
    priceChanged: result.products.filter(p => old.has(String(p.productId)) && old.get(String(p.productId)).price !== p.price).length,
    stockStatusChanged: result.products.filter(p => old.has(String(p.productId)) && old.get(String(p.productId)).availability !== p.availability).length,
    contactPrices: result.uncertain.length, imageFailures: result.imageFailures.length};
}

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function readSheetsJson(url, token, fetchImpl = fetch, sleep = delay) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(30000)});
    } catch {
      if (attempt === 2) throw new Error('Google Sheets network request failed after 3 attempts. Catalogue was not changed.');
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (!response.ok) {
      if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
        await sleep(1000 * 2 ** attempt); continue;
      }
      throw new Error(`Google Sheets read failed (HTTP ${response.status}). Catalogue was not changed.`);
    }
    try { return await response.json(); }
    catch { throw new Error('Google Sheets returned invalid JSON. Catalogue was not changed.'); }
  }
}
