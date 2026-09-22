import { readFile, writeFile, appendFile, access } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext, Script } from 'node:vm';
import { createHash } from 'node:crypto';

export function readWindow(source, key) {
  const context = { window: {} };
  runInNewContext(source, context, { timeout: 1000 });
  return JSON.parse(JSON.stringify(context.window[key]));
}

export function updatePrices(products, values) {
  if (!Array.isArray(products) || !products.length) throw new Error('Catalogue is empty.');
  const ids = products.map(p => String(p.productId ?? '').trim());
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error('Catalogue must contain unique, nonempty Product IDs.');
  }
  const headers = values?.[1];
  const required = ['product_id', 'sales_region_code', 'retail_price_value'];
  if (!Array.isArray(headers) || required.some(h => headers.filter(v => v === h).length !== 1)) {
    throw new Error('Expected unique price headers in row 2. Catalogue was not changed.');
  }
  const [idCol, regionCol, priceCol] = required.map(h => headers.indexOf(h));
  const byId = new Map();
  for (const row of values.slice(2)) {
    if (row[regionCol] !== 'MIENNAM') continue;
    const id = String(row[idCol] ?? '').trim();
    if (!id) continue;
    const value = row[priceCol];
    // Only accept actual numbers from UNFORMATTED_VALUE, never infer separators.
    const price = typeof value === 'number' && Number.isFinite(value) && value > 0
      && Number.isSafeInteger(Math.round(value * 1000)) && Math.round(value * 1000) > 0
      ? Math.round(value * 1000) : null;
    if (!byId.has(id)) byId.set(id, new Set());
    byId.get(id).add(price);
  }
  if (!byId.size) throw new Error('No MIENNAM data found. Catalogue was not changed.');
  const changes = [];
  const uncertain = [];
  const updated = products.map((product, index) => {
    const candidates = byId.get(ids[index]);
    const number = candidates?.size === 1 ? [...candidates][0] : null;
    const price = number == null ? 'Liên hệ' : number.toLocaleString('vi-VN') + 'đ';
    if (number == null) uncertain.push(ids[index]);
    if (price !== product.price) changes.push({ productId: ids[index], before: product.price, after: price });
    return { ...product, price };
  });
  return { products: updated, changes, uncertain };
}

export async function fetchPriceValues(config, token, fetchImpl = fetch) {
  if (!token) throw new Error('Missing GOOGLE_ACCESS_TOKEN.');
  if (config.PRICE_REGION !== 'MIENNAM' || config.PRICE_MULTIPLIER !== 1000) {
    throw new Error('Expected MIENNAM and multiplier 1000.');
  }
  const source = new URL(config.PRICE_SOURCE_SHEET_URL);
  const id = source.hostname === 'docs.google.com'
    && source.pathname.match(/^\/spreadsheets\/d\/([\w-]+)(?:\/|$)/)?.[1];
  if (!id || !config.PRICE_SHEET_NAME) throw new Error('Invalid price source configuration.');
  const range = "'" + config.PRICE_SHEET_NAME.replaceAll("'", "''") + "'!A1:F";
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`);
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60000),
  });
  // Do not print tokens, response bodies, or unrelated source rows to public logs.
  if (!response.ok) throw new Error(`Google Sheets read failed (HTTP ${response.status}). Catalogue was not changed.`);
  const data = await response.json();
  if (!Array.isArray(data.values)) throw new Error('Empty Sheets response. Catalogue was not changed.');
  return data.values;
}

export function renderUpdate(source, html, result) {
  if (!result.changes.length) return { catalogue: source, html };
  const catalogue = 'window.ANTIN_PRODUCTS = ' + JSON.stringify(result.products, null, 2) + ';\n';
  new Script(catalogue);
  const version = createHash('sha256').update(catalogue).digest('hex').slice(0, 12);
  const pattern = /(<script\s+src=")catalogue\.js(?:\?[^"\s]*)?("\s*>)/g;
  if ([...html.matchAll(pattern)].length !== 1) throw new Error('Expected one catalogue script in index.html.');
  return { catalogue, html: html.replace(pattern, `$1catalogue.js?v=${version}$2`) };
}

export async function validateAssets(root, html, products) {
  const references = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]);
  references.push(...products.map(p => p.image).filter(Boolean));
  for (const ref of references) {
    if (/^(?:https?:)?\/\//.test(ref)) continue;
    const file = resolve(root, ref.split(/[?#]/)[0]);
    const rel = relative(root, file);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Asset outside website directory.');
    await access(file);
  }
}

export async function syncPrices({ root = process.cwd(), token = process.env.GOOGLE_ACCESS_TOKEN, fetchImpl = fetch } = {}) {
  const read = name => readFile(resolve(root, name), 'utf8');
  const [source, html, configSource, app] = await Promise.all(['catalogue.js', 'index.html', 'config.js', 'app.js'].map(read));
  for (const text of [source, configSource, app]) new Script(text);
  const config = readWindow(configSource, 'ANTIN_CONFIG');
  const products = readWindow(source, 'ANTIN_PRODUCTS');
  const values = await fetchPriceValues(config, token, fetchImpl);
  const result = updatePrices(products, values);
  const output = renderUpdate(source, html, result);
  await validateAssets(root, output.html, result.products);
  if (result.changes.length) {
    await writeFile(resolve(root, 'catalogue.js'), output.catalogue, 'utf8');
    await writeFile(resolve(root, 'index.html'), output.html, 'utf8');
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await syncPrices();
    const summary = `Checked ${result.products.length} catalogue products; changed ${result.changes.length}; contact price ${result.uncertain.length}.`;
    console.log(summary);
    for (const id of result.uncertain) console.log(`::warning::Product ${id}: price missing, invalid, or conflicting; using Lien he.`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
