import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { updatePrices, updateCatalogue, readProductDetails, updateProductDetails, validatePriceScale, renderUpdate, readWindow, syncPrices, validateAssets } from './sync-prices.mjs';
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

test('Data san imports only A:G, ignores drifting H:J, keeps old images and uses dong directly', () => {
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
  assert.equal(result.products[2].active, '');
  assert.equal(result.products[2].indication, '');
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
    const config = { PRICE_SOURCE_SHEET_URL: 'https://docs.google.com/spreadsheets/d/test-id/edit', PRICE_SHEET_NAME: 'check', PRICE_REGION: 'MIENNAM', PRICE_MULTIPLIER: 1000, DETAIL_SOURCE_SHEET_URL:'https://docs.google.com/spreadsheets/d/backup-id/edit', DETAIL_SHEET_NAME:'Sheet1' };
    await Promise.all(Object.entries({ 'catalogue.js': source, 'index.html': html, 'config.js': 'window.ANTIN_CONFIG = ' + JSON.stringify(config) + ';', 'app.js': '', 'logo.svg': '<svg/>' }).map(([name, text]) => writeFile(join(root, name), text)));
    for (const fetchImpl of [async () => ({ ok: false, status: 403 }), async () => { throw new Error('Network unavailable'); }, async () => ({ ok: true, json: async () => ({ values: [] }) })]) {
      await assert.rejects(syncPrices({ root, token: 'test-only', fetchImpl }));
      assert.equal(await readFile(join(root, 'catalogue.js'), 'utf8'), source);
      assert.equal(await readFile(join(root, 'index.html'), 'utf8'), html);
    }
    const fetchImpl = async (url, options) => {
      assert.equal(url.hostname, 'sheets.googleapis.com');
      assert.equal(url.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE');
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      if (url.pathname.includes('/backup-id/')) {
        assert.match(decodeURIComponent(url.pathname), /'Sheet1'!A1:J$/);
        return {ok:true,json:async()=>({values:[detailHeaders,[1146,'MIENNAM','','','']]})};
      }
      assert.match(decodeURIComponent(url.pathname), /'check'!A1:G$/);
      return { ok: true, json: async () => ({ values: table(row(1146, 'MIENNAM', 113), row(1505, 'MIENNAM', 322)) }) };
    };
    assert.equal((await syncPrices({ root, token: 'test-only', fetchImpl })).changes.length, 2);
    const after = await readFile(join(root, 'catalogue.js'), 'utf8');
    assert.equal(readWindow(after, 'ANTIN_PRODUCTS')[0].price, '113.000đ');
    assert.equal((await syncPrices({ root, token: 'test-only', fetchImpl })).changes.length, 0);
    assert.equal(await readFile(join(root, 'catalogue.js'), 'utf8'), after);
    // A backup-only failure must also leave the previous catalogue and cache intact.
    const afterHtml = await readFile(join(root,'index.html'),'utf8');
    for (const backupResponse of [{ok:false,status:403},{ok:true,json:async()=>({values:[['bad header']]})}]) {
      await assert.rejects(syncPrices({root,token:'test-only',fetchImpl:(url,options)=>url.pathname.includes('/backup-id/')?Promise.resolve(backupResponse):fetchImpl(url,options)}));
      assert.equal(await readFile(join(root,'catalogue.js'),'utf8'),after);
      assert.equal(await readFile(join(root,'index.html'),'utf8'),afterHtml);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const detailHeaders = ['product_id','sales_region_code','Hoạt chất','Chỉ định','link ảnh URL'];

test('feed-wide 1000x unit changes stop publication; ordinary price changes and contact prices remain valid',()=>{
  const before = Array.from({length:20},(_,i)=>({productId:String(i),price:'113.000đ'}));
  const after = price=>before.map(p=>({...p,price}));
  assert.throws(()=>validatePriceScale(before,after('113đ')),/1000x/);
  assert.throws(()=>validatePriceScale(before,after('113.000.000đ')),/1000x/);
  assert.doesNotThrow(()=>validatePriceScale(before,after('114.000đ')));
  assert.doesNotThrow(()=>validatePriceScale(before,after('Liên hệ')));
  assert.doesNotThrow(()=>validatePriceScale(before,[{...before[0],price:'113đ'},...before.slice(1)]));
});

test('backup joins exact southern IDs regardless of row order and never supplies price or name', () => {
  const values = [[], [...headers,'Check tồn','Hoạt chất','Chỉ định','link ảnh URL'],
    [...row(1505,'MIENNAM',322000),'PRIVATE STOCK','Wrong drug','Wrong use','https://wrong-image'],
    [...row(1146,'MIENNAM',113000),'PRIVATE STOCK','Shifted active','Shifted use','https://shifted-image'],
    row(9001,'MIENNAM',42000)];
  const backup = [ [...detailHeaders,'retail_price_value','product_name'],
    [1146,'MIENBAC','Northern active','Northern indication','north.jpg',1,'North name'],
    [1146,'MIENNAM','Correct active','Correct use','https://cdn-gcs.thuocsi.vn/1146',999,'Stale name'],
    [9002,'MIENNAM','Backup only','Backup only','','', 'Do not add'],
    [1505,'MIENNAM','','','','','']];
  const priced = updateCatalogue(products,values,1);
  const details = readProductDetails(backup);
  const merged = updateProductDetails(priced.products,details);
  assert.equal(merged[0].active,'Correct active');
  assert.equal(merged[0].indication,'Correct use');
  assert.equal(merged[0].price,'113.000đ');
  assert.equal(merged[0].name,'Source name');
  assert.equal(merged[1].indication,'Existing indication');
  assert.equal(merged[2].active,'');
  assert.equal(merged.length,3);
  assert.doesNotMatch(JSON.stringify(merged),/Wrong|Shifted|Northern|PRIVATE STOCK|Stale name|9002/);
  assert.deepEqual(updateProductDetails(priced.products,readProductDetails([backup[0],...backup.slice(1).reverse()])),merged);
  assert.equal(details.get('1146').imageUrl,'https://cdn-gcs.thuocsi.vn/1146');
  // Existing products missing from the price feed can still receive backup details.
  assert.equal(updateProductDetails(products,details)[0].indication,'Correct use');
});

test('backup rejects conflicting IDs, malformed headers and cell errors before publishing', () => {
  const good=[1146,'MIENNAM','Active','Use','https://cdn-gcs.thuocsi.vn/a'];
  assert.equal(readProductDetails([detailHeaders,good,good]).size,1);
  for (const values of [[],[detailHeaders],[[],detailHeaders,good],
    [[...detailHeaders,'Hoạt chất'],good],
    [detailHeaders,[1146,'MIENBAC','A','I','']],
    [detailHeaders,['','MIENNAM','A','I','']],
    [detailHeaders,[1146,'MIENNAM',123,'I','']],
    [detailHeaders,[1146,'MIENNAM','#REF!','I','']],
    [detailHeaders,good,[1146,'MIENNAM','Other','Use',good[4]]],
    [detailHeaders,good,[1146,'MIENNAM','Active','Use','https://cdn-gcs.thuocsi.vn/b']]]) {
    assert.throws(()=>readProductDetails(values));
  }
});
