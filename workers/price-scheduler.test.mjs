import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inWindow, inspectPublication, runCheck} from './price-scheduler-core.mjs';
import worker, {PriceScheduler, sendSchedulerMail} from './price-scheduler.mjs';

const now = new Date('2026-09-30T05:07:00Z');
const catalogue = 'window.ANTIN_PRODUCTS=[];';
const hash = createHash('sha256').update(catalogue).digest('hex');
const audit = {status: 'checked', freshness: 'fresh', checkedAt: '2026-09-30T04:30:00Z',
  sourceUpdatedAt: '2026-09-30T04:00:00Z', catalogueSha256: hash};
function fixture(options = {}) {
  const records = new Map(), calls = [], mails = [];
  const storage = {async get(k) { return structuredClone(records.get(k)); },
    async put(k,v) { records.set(k,structuredClone(v)); }, async delete(k) { records.delete(k); },
    async transaction(fn) { return fn(storage); }};
  const fetchImpl = async (url, init = {}) => {
    assert.equal(init.redirect,'manual'); // Workers supports manual/follow, not redirect:error.
    calls.push({url, method: init.method || 'GET'});
    if (url.includes('api.github.com')) {
      if (options.apiError) throw Error('private-secret-must-not-leak');
      assert.equal(init.headers.Authorization, 'Bearer test-placeholder');
      if (url.endsWith('/dispatches')) {
        assert.ok((await storage.get('state')).lastAttemptAt);
        assert.equal(JSON.parse(init.body).ref, 'main');
        return new Response(null, {status: options.dispatchStatus || 204});
      }
      return Response.json({workflow_runs: options.runs || []});
    }
    if (url.includes('/data/')) return Response.json(options.audit || audit);
    if (url.includes('catalogue.js')) return new Response(options.catalogue || catalogue);
    return new Response(`<script src="catalogue.js?v=${options.version || hash.slice(0, 12)}"></script>`);
  };
  const env = {GITHUB_SCHEDULER_TOKEN:'test-placeholder', PRICE_REPORT_APP_PASSWORD:'test-only'};
  const sendMail = async mail => { mails.push(mail); if(options.mailError) throw Error('private-smtp-error'); return true; };
  return {storage,calls,mails,env,fetchImpl,sendMail,now};
}
const stale = {...audit, sourceUpdatedAt: '2026-09-29T04:00:00Z'};

test('VN schedule starts 11:17, stops 19:00, and handles UTC day boundaries', () => {
  assert.equal(inWindow(new Date('2026-09-30T04:16:00Z')),false);
  assert.equal(inWindow(new Date('2026-09-30T04:17:00Z')),true);
  assert.equal(inWindow(new Date('2026-09-30T11:57:00Z')),true);
  assert.equal(inWindow(new Date('2026-09-30T12:00:00Z')),false);
  assert.equal(inWindow(new Date('2026-09-30T17:17:00Z')),false);
});
test('verification rejects yesterday, future timestamps, wrong bytes and wrong cache version', async () => {
  for (const options of [{audit:stale}, {audit:{...audit,checkedAt:'2026-09-30T08:00:00Z'}},
    {audit:{...audit,sourceUpdatedAt:'2026-09-30T06:00:00Z'}}, {catalogue:'wrong'}, {version:'wrong'}]) {
    assert.equal((await inspectPublication(now,fixture(options).fetchImpl)).verified,false);
  }
  assert.equal((await inspectPublication(now,fixture().fetchImpl)).verified,true);
});
test('fresh verified site skips dispatch and sends one independent receipt each day', async () => {
  const f = fixture();
  assert.equal((await runCheck(f)).outcome,'verified');
  await runCheck(f);
  assert.equal(f.calls.filter(c=>c.url.includes('api.github')).length,0);
  assert.equal(f.mails.length,1);
  assert.match(f.mails[0].subject,/ĐÃ XÁC MINH/);
  assert.equal((await f.storage.get('state')).mail.verified.outcome,'smtp_accepted');
});
test('yesterday source dispatches, persists cooldown, and warns once after noon', async () => {
  const f=fixture({audit:stale});
  assert.equal((await runCheck(f)).outcome,'dispatch_accepted');
  assert.equal((await runCheck(f)).outcome,'retry_cooldown');
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  assert.equal(f.mails.length,1);
  assert.match(f.mails[0].subject,/CẢNH BÁO/);
  await runCheck({...f,now:new Date(now.getTime()+10*60000)});
  assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
  assert.equal(f.mails.length,1);
});

test('many retries and a recovery send at most one warning and one confirmation per Vietnam day', async () => {
  const f=fixture({audit:stale});
  for(let i=0;i<12;i++)await runCheck({...f,now:new Date(now.getTime()+i*10*60000)});
  assert.equal(f.mails.length,1);
  const recovered={...f,fetchImpl:fixture().fetchImpl,now:new Date(now.getTime()+2*3600000)};
  for(let i=0;i<12;i++)await runCheck(recovered);
  assert.equal(f.mails.length,2);
  assert.match(f.mails[0].subject,/CẢNH BÁO/);
  assert.match(f.mails[1].subject,/ĐÃ XÁC MINH/);
  // A new run/isolate and explicit test cannot bypass persisted reservations.
  await runCheck({...recovered,manual:true,testMail:true});
  await runCheck({...f,manual:true});
  assert.equal(f.mails.length,2);
  assert.deepEqual(Object.keys((await f.storage.get('state')).mail).sort(),['verified','warning']);
  const instance=new PriceScheduler({storage:f.storage},f.env);
  const health=await (await instance.fetch(new Request('https://internal/health'))).json();
  assert.equal(health.notificationLimit,2);
  assert.equal(health.notificationAttempts,2);
  assert.equal(health.notificationDay,'2026-09-30');
});

test('unconfirmed SMTP counts toward the two-mail limit; admin tests cannot create a third send', async () => {
  const f=fixture({audit:stale,mailError:true});
  await runCheck(f);
  await runCheck({...f,manual:true,testMail:true});
  await runCheck({...f,fetchImpl:fixture().fetchImpl});
  assert.equal(f.mails.length,2);
  const mail=(await f.storage.get('state')).mail;
  assert.equal(mail.warning.outcome,'unconfirmed');
  assert.equal(mail.test.outcome,'unconfirmed');
  assert.equal(mail.verified,undefined);
});

test('notification quota resets at Vietnam midnight and never repeats in the new day', async () => {
  const f=fixture({audit:stale});await runCheck(f);
  await runCheck({...f,fetchImpl:fixture().fetchImpl});assert.equal(f.mails.length,2);
  const nextDay=new Date('2026-09-30T17:07:00Z');
  const options={...f,now:nextDay,manual:true,fetchImpl:fixture({audit:{...audit,
    checkedAt:'2026-09-30T17:02:00Z',sourceUpdatedAt:'2026-09-30T17:00:00Z'}}).fetchImpl};
  await runCheck(options);await runCheck(options);
  assert.equal(f.mails.length,3);
  const state=await f.storage.get('state');assert.equal(state.day,'2026-10-01');
  assert.deepEqual(Object.keys(state.mail),['verified']);
});
test('queued/running workflow prevents duplicate, even when queue is delayed', async () => {
  const f=fixture({audit:stale,runs:[{id:1,head_branch:'main',status:'queued'}]});
  assert.equal((await runCheck(f)).outcome,'workflow_active');
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
  assert.equal(f.mails.length,1);
});
test('missing/denied GitHub credential still allows independent email; errors do not leak', async () => {
  for (const missing of [true,false]) {
    const f=fixture({audit:stale,apiError:true});
    if(missing) delete f.env.GITHUB_SCHEDULER_TOKEN;
    const result=await runCheck(f);
    assert.equal(result.outcome,missing?'missing_github_token':'github_unavailable_or_denied');
    assert.equal(f.mails.length,1);
    assert.ok(!JSON.stringify(result).includes('private-secret'));
    assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
  }
});
test('dispatch denial is not success and ambiguous SMTP is not retried or called accepted', async () => {
  const f=fixture({audit:stale,dispatchStatus:403,mailError:true});
  const first=await runCheck(f);
  assert.equal(first.outcome,'github_unavailable_or_denied');
  assert.equal(first.lastDispatchAt,undefined);
  assert.equal(first.mail.warning.outcome,'unconfirmed');
  await runCheck(f);
  assert.equal(f.mails.length,1);
  assert.ok(!JSON.stringify(await f.storage.get('state')).includes('private-smtp'));
});
test('missing mail credentials never mark sent; adding them enables one receipt', async () => {
  const f=fixture(); delete f.env.PRICE_REPORT_APP_PASSWORD;
  assert.deepEqual((await runCheck(f)).mail,{});
  assert.equal(f.mails.length,0);
  f.env.PRICE_REPORT_APP_PASSWORD='test-only';
  await runCheck(f);
  assert.equal(f.mails.length,1);
});
test('after three dispatch attempts retry spacing becomes 30 minutes', async () => {
  const f=fixture({audit:stale});
  await f.storage.put('state',{day:'2026-09-30',attempts:3,lastAttemptAt:'2026-09-30T04:57:00Z',mail:{}});
  assert.equal((await runCheck(f)).outcome,'retry_cooldown');
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
});
test('persistent lease prevents concurrent Cron checks; public endpoint cannot dispatch', async () => {
  const f=fixture(); await f.storage.put('leaseUntil',Date.now()+60000);
  const instance=new PriceScheduler({storage:f.storage},f.env);
  assert.equal((await (await instance.fetch(new Request('https://internal/check',{method:'POST'}))).json()).outcome,'check_active');
  assert.equal((await worker.fetch(new Request('https://example.test/check',{method:'POST'}),{})).status,405);
  assert.equal((await worker.fetch(new Request('https://example.test/check'),{})).status,404);
});
test('SMTP uses TLS, exact recipient, and closes transport on failure', async () => {
  let closed=false;
  const result=await sendSchedulerMail({},'test-only', options=>{
    assert.equal(options.secure,true); assert.equal(options.port,465);
    assert.equal(options.auth.user,'nguyenphuockhaimkn@gmail.com');
    return {sendMail:async()=>{throw Error('smtp');}, close(){closed=true;}};
  });
  assert.equal(result.accepted,false);
  assert.equal(closed,true);
});

test('explicit admin dispatch tests credentials on a fresh site but respects active runs and cooldown', async () => {
  const f=fixture();
  assert.equal((await runCheck({...f,manual:true,forceDispatch:true})).outcome,'dispatch_accepted');
  assert.equal((await runCheck({...f,manual:true,forceDispatch:true})).outcome,'retry_cooldown');
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  const active=fixture({runs:[{id:1,head_branch:'main',status:'in_progress'}]});
  assert.equal((await runCheck({...active,manual:true,forceDispatch:true})).outcome,'workflow_active');
});

test('admin routes require the exact secret and only forward fixed internal operations', async () => {
  let called=0;
  const env={SCHEDULER_ADMIN_KEY:'test-admin',SCHEDULER:{idFromName:()=>1,get:()=>({fetch:async url=>{
    called++; assert.equal(url,'https://internal/check?manual=1&dispatch=1'); return Response.json({ok:true});
  }})}};
  for(const auth of ['', 'Bearer bad', 'Bearer test-admiN']) {
    const r=await worker.fetch(new Request('https://test/admin/dispatch-check',{method:'POST',headers:{Authorization:auth}}),env);
    assert.equal(r.status,401);
  }
  assert.equal(called,0);
  const r=await worker.fetch(new Request('https://test/admin/dispatch-check',{method:'POST',headers:{Authorization:'Bearer test-admin'}}),env);
  assert.equal(r.status,200); assert.equal(called,1);
});

test('manual mail test is separately labelled, deduplicated and does not retry uncertain daily mail', async () => {
  const f=fixture();
  await f.storage.put('state',{day:'2026-09-30',attempts:0,mail:{verified:{outcome:'unconfirmed'}}});
  for(let i=0;i<2;i++) await runCheck({...f,manual:true,testMail:true});
  assert.equal(f.mails.length,1);
  assert.match(f.mails[0].subject,/KIỂM TRA BỘ HẸN GIỜ/);
  const state=await f.storage.get('state');
  assert.equal(state.mail.test.outcome,'smtp_accepted');
  assert.equal(state.mail.verified.outcome,'unconfirmed');
});

test('health evidence distinguishes real cron from operator checks', async () => {
  const f=fixture();
  const cron=await runCheck(f);
  assert.equal(cron.lastTrigger,'cron');
  assert.equal(cron.lastCronAt,now.toISOString());
  const manual=await runCheck({...f,manual:true,now:new Date(now.getTime()+60000)});
  assert.equal(manual.lastTrigger,'manual');
  assert.equal(manual.lastCronAt,cron.lastCronAt);
});
