import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {delay} from './price-audit.mjs';

export async function verifyPublished({hash, checkedAt, fetchImpl = fetch, sleep = delay}) {
  if (!/^[a-f0-9]{64}$/.test(hash || '') || !Number.isFinite(Date.parse(checkedAt))) throw new Error('Missing expected publication identity.');
  const base = 'https://antinpharma.github.io/an-tin-pharma-website/';
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const nonce = `${Date.now()}-${attempt}`;
      const [catalogue, status, home] = await Promise.all(['catalogue.js', 'data/catalogue-status.json', 'index.html'].map(file =>
        fetchImpl(`${base}${file}?verify=${nonce}`, {cache: 'no-store', signal: AbortSignal.timeout(15000)})));
      if (![catalogue, status, home].every(response => response.ok)) throw new Error('Not yet available');
      const text = await catalogue.text(), audit = await status.json(), html = await home.text();
      const actual = createHash('sha256').update(text).digest('hex');
      if (actual === hash && audit.catalogueSha256 === hash && audit.checkedAt === checkedAt &&
          html.includes(`catalogue.js?v=${hash.slice(0, 12)}`)) return {verified: true};
    } catch { /* CDN propagation or transient network error; retry GET only. */ }
    if (attempt < 7) await sleep(5000);
  }
  throw new Error('Published catalogue/index/status do not match this sync. Website update NOT verified.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  verifyPublished({hash: process.env.EXPECTED_CATALOGUE_SHA, checkedAt: process.env.EXPECTED_CHECKED_AT})
    .then(() => console.log('Verified live catalogue SHA-256, index cache version and sync timestamp.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
