import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { updatePrices, updateCatalogue, renderUpdate, readWindow, syncPrices, validateAssets } from './sync-prices.mjs';
import { syncImages, imageSources } from './sync-images.mjs';
import sharp from 'sharp';

test('image sync matches southern IDs, caches downloaded files and keeps old images on failure or blank URL', async () => {
  const root = await mkdtemp(join(tmpdir(), 'antin-images-'));
  try {
    const values = [[], ['product_id','sales_region_code','link ảnh URL'],
      [1146,'MIENNAM','https://cdn-gcs.thuocsi.vn/one'],
      [1505,'MIENBAC','https://cdn-gcs.thuocsi.vn/north'],
      [1505,'MIENNAM','']];
    let calls = 0;
    const png = await sharp({create:{width:1200,height:600,channels:3,background:'#ffffff'}}).png().toBuffer();
    const fetchImage = async () => { calls++; return new Response(png,{headers:{'content-type':'image/png'}}); };
    const first = await syncImages(root, products, values, fetchImage);
    assert.equal(first.downloaded,1); assert.equal(calls,1);
    assert.match(first.products[0].image,/^images\/sheet\/[a-f0-9]+\.webp$/);
    assert.equal(first.products[1].image,products[1].image);
    assert.equal((await readFile(join(root,first.products[0].image))).subarray(8,12).toString(),'WEBP');
    const metadata = await sharp(await readFile(join(root,first.products[0].image))).metadata();
    assert.equal(metadata.width,1000); assert.equal(metadata.height,500);
    const second = await syncImages(root, products, values, fetchImage);
    assert.equal(second.downloaded,0); assert.equal(calls,1);
    values[2][2] = 'https://cdn-gcs.thuocsi.vn/broken';
    const failed = await syncImages(root, first.products, values, async()=>new Response('<html>error</html>'));
    assert.equal(failed.failures.length,1); assert.equal(failed.products[0].image,first.products[0].image);
    values[2][2] = 'http://127.0.0.1/private';
    assert.equal((await syncImages(root,products,values,fetchImage)).failures.length,1);
    assert.equal(calls,1);
    assert.throws(()=>imageSources([...values,[1146,'MIENNAM','https://cdn-gcs.thuocsi.vn/conflict']]));
  } finally { await rm(root,{recursive:true,force:true}); }
});

const headers = ['product_id', 'sales_region_code', 'product_name', 'brand', 'product_category', 'retail_price_value'];
const table = (...rows) => [['Update: 10h 22/9'], headers, ...rows];
const row = (id, region, price) => [id, region, 'Source name', 'Brand', 'Category', price];
const products = [
  { productId: '1146', name: 'Klenzit-C Gel', price: '108.400đ', spec: 'Tuýp 15g', active: 'Existing data', image: 'logo.svg', visible: true },
  { productId: '1505', name: 'Nexium MUPS 40mg', price: '322.000đ', indication: 'Existing indication', visible: true },
];

test('Data san imports only southern catalogue fields, keeps old images and uses dong directly', () => {
  const original = structuredClone(products);
  const values = [[], [...headers, 'Check tồn', 'Hoạt chất', 'Chỉ định', 'Ảnh'],
    [...row(1146, 'MIENNAM', 113000), 'PRIVATE STOCK', '', '', 'https://example.com/replacement.jpg'],
    [...row(9001, 'MIENNAM', 322000), 'PRIVATE STOCK', 'Source active', 'Source indication', 'https://example.com/new.jpg'],
    row(9999, 'MIENBAC', 1000),
  ];
  const result = updateCatalogue(products, values, 1);
  assert.equal(result.added, 1);
  assert.equal(result.products.length, 3);
  assert.equal(result.products[0].price, '113.000đ');
  assert.equal(result.products[0].image, products[0].image);
  assert.equal(result.products[0].active, products[0].active);
  assert.equal(result.products[0].spec, products[0].spec);
  assert.equal(result.products[0].name, 'Source name');
  assert.equal(result.products[1].indication, products[1].indication);
  assert.equal(result.products[1].price, 'Liên hệ');
  assert.equal(result.products[2].price, '322.000đ');
  assert.equal(result.products[2].active, 'Source active');
  assert.equal(result.products[2].image, '');
  assert.doesNotMatch(JSON.stringify(result.products), /PRIVATE STOCK|example\.com|9999/);
  assert.deepEqual(products, original);
  assert.equal(updateCatalogue(result.products, values, 1).changes.length, 0);
});

test('catalogue refuses ambiguous metadata and invalid structure, but marks uncertain prices', () => {
  const conflicting = row(1146, 'MIENNAM', 113000);
  conflicting[2] = 'Different name';
  assert.throws(() => updateCatalogue(products, table(row(1146, 'MIENNAM', 113000), conflicting), 1));
  assert.throws(() => updateCatalogue(products, [[], ['product_id', 'sales_region_code', 'retail_price_value'], [1146, 'MIENNAM', 113000]], 1));
  assert.throws(() => updateCatalogue(products, table(row('', 'MIENNAM', 113000)), 1));
  assert.throws(() => updateCatalogue(products, table(row(1146, 'MIENBAC', 113000)), 1));
  assert.throws(() => updateCatalogue([products[0], products[0]], table(row(1146, 'MIENNAM', 113000)), 1));
  const result = updateCatalogue(products, table(row(1146, 'MIENNAM', 113000), row(1146, 'MIENNAM', 114000)), 1);
  assert.equal(result.products[0].price, 'Liên hệ');
});

test('website JavaScript parses and referenced local assets exist', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const file of ['app.js', 'config.js', 'catalogue.js']) new Script(await readFile(join(root, file), 'utf8'));
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const catalogue = readWindow(await readFile(join(root, 'catalogue.js'), 'utf8'), 'ANTIN_PRODUCTS');
  await validateAssets(root, html, catalogue);
});

test('exact ID and region matching; multiply once; preserve product data', () => {
  const original = structuredClone(products);
  const result = updatePrices(products, table(
    row(1146, 'MIENBAC', 111.411), row(1146, 'MIENNAM', 113),
    row(1505, 'MIENNAM', 322), row(15052, 'MIENNAM', 45.054),
    row(9999, 'MIENNAM', 50),
  ));
  assert.deepEqual(result.products, [{ ...products[0], price: '113.000đ' }, products[1]]);
  assert.deepEqual(products, original);
  assert.equal(result.changes.length, 1);
  assert.equal(result.products.length, 2);
});

test('decimal prices retain dong precision', () => {
  assert.equal(updatePrices([products[0]], table(row(1146, 'MIENNAM', 108.401))).products[0].price, '108.401đ');
});

test('missing, invalid, and conflicting prices become contact, never zero or guessed', () => {
  for (const value of [undefined, '', '113,000', '113', '#N/A', 0, -1, NaN, Infinity, 1e20]) {
    const result = updatePrices(products, table(row(1146, 'MIENNAM', value)));
    assert.deepEqual(result.products.map(p => p.price), ['Liên hệ', 'Liên hệ']);
    assert.deepEqual(result.uncertain, ['1146', '1505']);
  }
  const result = updatePrices(products, table(row(1146, 'MIENNAM', 113), row(1146, 'MIENNAM', 114)));
  assert.equal(result.products[0].price, 'Liên hệ');
  assert.equal(updatePrices(products, table(row(1146, 'MIENNAM', 113), row(1146, 'MIENNAM', 113))).products[0].price, '113.000đ');
});

test('empty/wrong source and duplicate catalogue IDs stop the update', () => {
  for (const values of [[], [['product_id']], table(), table(row(1146, 'MIENBAC', 113))]) {
    assert.throws(() => updatePrices(products, values));
  }
  assert.throws(() => updatePrices([products[0], products[0]], table(row(1146, 'MIENNAM', 113))));
});

test('no-op keeps exact files; changed price changes cache and preserves config script', () => {
  const source = 'window.ANTIN_PRODUCTS = ' + JSON.stringify(products) + ';';
  const html = '<script src="config.js?v=1"></script><script src="catalogue.js?v=old"></script>';
  const unchanged = updatePrices(products, table(row(1146, 'MIENNAM', 108.4), row(1505, 'MIENNAM', 322)));
  assert.deepEqual(renderUpdate(source, html, unchanged), { catalogue: source, html });
  const changed = updatePrices(products, table(row(1146, 'MIENNAM', 113), row(1505, 'MIENNAM', 322)));
  const rendered = renderUpdate(source, html, changed);
  assert.match(rendered.html, /catalogue\.js\?v=[a-f0-9]{12}/);
  assert.match(rendered.html, /config\.js\?v=1/);
  assert.deepEqual(readWindow(rendered.catalogue, 'ANTIN_PRODUCTS'), changed.products);
  assert.throws(() => renderUpdate(source, '<html></html>', changed));
});

test('sync uses authenticated unformatted read; failure leaves files intact; repeat is a no-op', async () => {
  const root = await mkdtemp(join(tmpdir(), 'antin-prices-'));
  try {
    const source = 'window.ANTIN_PRODUCTS = ' + JSON.stringify(products) + ';';
    const html = '<script src="config.js"></script><script src="catalogue.js?v=old"></script>';
    const config = { PRICE_SOURCE_SHEET_URL: 'https://docs.google.com/spreadsheets/d/test-id/edit', PRICE_SHEET_NAME: 'check', PRICE_REGION: 'MIENNAM', PRICE_MULTIPLIER: 1000 };
    await Promise.all(Object.entries({ 'catalogue.js': source, 'index.html': html, 'config.js': 'window.ANTIN_CONFIG = ' + JSON.stringify(config) + ';', 'app.js': '', 'logo.svg': '<svg/>' }).map(([name, text]) => writeFile(join(root, name), text)));
    for (const fetchImpl of [async () => ({ ok: false, status: 403 }), async () => { throw new Error('Network unavailable'); }, async () => ({ ok: true, json: async () => ({ values: [] }) })]) {
      await assert.rejects(syncPrices({ root, token: 'test-only', fetchImpl }));
      assert.equal(await readFile(join(root, 'catalogue.js'), 'utf8'), source);
      assert.equal(await readFile(join(root, 'index.html'), 'utf8'), html);
    }
    const fetchImpl = async (url, options) => {
      assert.equal(url.hostname, 'sheets.googleapis.com');
      assert.equal(url.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE');
      assert.match(decodeURIComponent(url.pathname), /'check'!A1:W$/);
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      return { ok: true, json: async () => ({ values: table(row(1146, 'MIENNAM', 113), row(1505, 'MIENNAM', 322)) }) };
    };
    assert.equal((await syncPrices({ root, token: 'test-only', fetchImpl })).changes.length, 2);
    const after = await readFile(join(root, 'catalogue.js'), 'utf8');
    assert.equal(readWindow(after, 'ANTIN_PRODUCTS')[0].price, '113.000đ');
    assert.equal((await syncPrices({ root, token: 'test-only', fetchImpl })).changes.length, 0);
    assert.equal(await readFile(join(root, 'catalogue.js'), 'utf8'), after);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
