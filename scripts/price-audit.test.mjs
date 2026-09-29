import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceTime, buildAudit, readSheetsJson} from './price-audit.mjs';
import {syncDue} from './check-sync-window.mjs';
import {verifyPublished} from './verify-published-prices.mjs';
import {makePriceMail, sendPriceMail} from './notify-prices.mjs';
import {updateCatalogue} from './sync-prices.mjs';

const now = new Date('2026-09-29T04:17:00Z');
test('source date uses Vietnam time and distinguishes stale/unknown/future/invalid dates', () => {
  assert.deepEqual(sourceTime([['Update: 10h 29/9']], now), {sourceUpdatedAt: '2026-09-29T03:00:00.000Z', sourceLabel: 'Update: 10h 29/9', freshness: 'fresh'});
  assert.equal(sourceTime([['Update: 10h 26/9']], now).freshness, 'stale');
  assert.equal(sourceTime([['Update: 10h 30/9']], now).freshness, 'future');
  for (const label of ['Update: 25h 29/9', 'Update: 10h 31/2', 'Internal inventory notes', '']) {
    assert.equal(sourceTime([[label]], now).freshness, 'unknown');
    assert.equal(sourceTime([[label]], now).sourceLabel, null);
  }
  assert.equal(sourceTime([['Update: 10h 31/12']], new Date('2027-01-01T04:00:00Z')).sourceUpdatedAt, '2026-12-31T03:00:00.000Z');
});

test('temporary failures retry; permanent access errors and invalid JSON do not; credentials never leak', async () => {
  let calls = 0;
  const fetchImpl = async () => ++calls === 1 ? new Response('', {status: 503}) : Response.json({values: [1]});
  assert.deepEqual(await readSheetsJson('https://sheets.googleapis.com/', 'secret', fetchImpl, async () => {}), {values: [1]});
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(readSheetsJson('https://sheets.googleapis.com/', 'secret', async () => { calls++; return new Response('', {status: 403}); }, async () => {}), /HTTP 403/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(readSheetsJson('https://sheets.googleapis.com/', 'secret', async () => { calls++; throw Error('secret'); }, async () => {}), error => /3 attempts/.test(error.message) && !error.message.includes('secret'));
  assert.equal(calls, 3);
  await assert.rejects(readSheetsJson('', 'secret', async () => new Response('<html>bad</html>'), async () => {}), /invalid JSON/);
});

test('audit separates price changes, stock status changes and no-op checks without exposing stock counts', () => {
  const before = [{productId: '1', price: '100.000đ', availability: 'in_stock'}];
  const result = {products: [{...before[0], price: '101.000đ'}], added: 0, changes: [{}], uncertain: [], imageFailures: []};
  const report = buildAudit(before, result, [['Update: 10h 29/9']], 'catalogue', now);
  assert.equal(report.priceChanged, 1); assert.equal(report.stockStatusChanged, 0);
  assert.equal(report.lastChangedAt, now.toISOString());
  const unchanged = buildAudit(result.products, {...result, changes: []}, [['Update: 10h 29/9']], 'catalogue', new Date(now.getTime() + 3600000), report);
  assert.equal(unchanged.priceChanged, 0);
  assert.equal(unchanged.lastChangedAt, report.lastChangedAt);
  assert.notEqual(unchanged.checkedAt, report.checkedAt);
  assert.equal(Object.hasOwn(report, 'stock'), false);
});

test('backup runs only when a same-day fresh sync is not available; manual and primary always run', () => {
  const status = {status: 'checked', freshness: 'fresh', checkedAt: now.toISOString(), sourceUpdatedAt: '2026-09-29T03:00:00Z'};
  const options = {event: 'schedule', schedule: '47 8 * * *', now};
  assert.equal(syncDue(status, options), false);
  assert.equal(syncDue({...status, freshness: 'stale'}, options), true);
  assert.equal(syncDue({...status, checkedAt: '2026-09-28T04:00:00Z'}, options), true);
  assert.equal(syncDue(null, options), true);
  assert.equal(syncDue(status, {...options, event: 'workflow_dispatch'}), true);
  assert.equal(syncDue(status, {...options, schedule: '17 4 * * *'}), true);
});

test('live verification requires all three: catalogue bytes, index version and this run timestamp', async () => {
  const catalogue = 'window.ANTIN_PRODUCTS=[];', hash = createHash('sha256').update(catalogue).digest('hex');
  let wrong = true;
  const fetchImpl = async url => url.includes('/data/') ? Response.json({catalogueSha256: hash, checkedAt: wrong ? 'yesterday' : now.toISOString()}) :
    url.includes('/index.html') ? new Response(`<script src="catalogue.js?v=${hash.slice(0, 12)}"></script>`) : new Response(catalogue);
  await assert.rejects(verifyPublished({hash, checkedAt: now.toISOString(), fetchImpl, sleep: async () => {}}), /NOT verified/);
  wrong = false;
  assert.equal((await verifyPublished({hash, checkedAt: now.toISOString(), fetchImpl, sleep: async () => {}})).verified, true);
});

test('reports never claim success after deployment/verification failure or stale source', () => {
  const args = {report: {status: 'checked', freshness: 'fresh', checkedAt: now.toISOString(), sourceUpdatedAt: now.toISOString(), total: 5, added: 0, priceChanged: 2, stockStatusChanged: 1, contactPrices: 0, imageFailures: 0},
    syncResult: 'success', deployResult: 'success', verifyResult: 'success', runUrl: 'https://github.com/antinpharma/an-tin-pharma-website/actions/runs/1'};
  assert.match(makePriceMail(args).subject, /ĐÃ KIỂM TRA/);
  assert.match(makePriceMail({...args, verifyResult: 'failure'}).subject, /LỖI/);
  assert.match(makePriceMail({...args, report: {...args.report, freshness: 'stale'}}).subject, /CẢNH BÁO/);
  assert.match(makePriceMail({...args, report: null, syncResult: 'failure'}).text, /Chưa xác nhận/);
});

test('SMTP requires credentials and acceptance; no automatic retries or raw SMTP error disclosure', async () => {
  assert.equal((await sendPriceMail({}, '')).reason, 'missing_credentials');
  let calls = 0, closed = false;
  const createTransport = options => {
    assert.equal(options.secure, true); assert.equal(options.auth.pass, 'abcd');
    return {sendMail: async () => { calls++; throw new Error('secret server info'); }, close: () => closed = true};
  };
  await assert.rejects(sendPriceMail({}, 'ab cd', createTransport), error => !error.message.includes('secret server info'));
  assert.equal(calls, 1); assert.equal(closed, true);
  assert.equal((await sendPriceMail({}, 'abcd', () => ({sendMail: async () => ({accepted: ['nguyenphuockhaimkn@gmail.com']}), close() {}}))).sent, true);
});

test('blank source text preserves known product data; new missing names use explicit placeholder', () => {
  const values = [[], ['product_id','sales_region_code','product_name','brand','product_category','retail_price_value','Tồn khả dụng'],
    [1, 'MIENNAM', '', '', '', 113, 2], [2, 'MIENNAM', '', '', '', 322, 0]];
  const result = updateCatalogue([{productId: '1', name: 'Known', brand: 'Brand', category: 'Category', price: '110.000đ'}], values, 1000);
  assert.equal(result.products[0].name, 'Known'); assert.equal(result.products[0].brand, 'Brand');
  assert.equal(result.products[0].price, '113.000đ');
  assert.equal(result.products[1].name, 'Đang cập nhật'); assert.equal(result.products[1].price, '322.000đ');
});
