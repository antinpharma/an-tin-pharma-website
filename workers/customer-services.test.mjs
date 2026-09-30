import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{OrderReceiver} from './orders.mjs';
import {historySnapshot,listHistory,validateFeedback,feedbackMessage} from './customer-services.mjs';
const id='e387f966-064c-4fd5-8f6b-85ea1dc21ac6';
const products=[{productId:'1',name:'Sản phẩm A',price:'21.100đ',visible:true}];
const env={ZALO_BOT_TOKEN:'test-token',CATALOGUE_URL:'https://catalogue.test',ALLOWED_ORIGIN:'https://shop.test',REQUIRE_ACCOUNT_LOGIN:'true'};
const body=()=>({requestId:id,accountId:'a',customer:{name:'Khách thử',phone:'0905561550'},items:[{productId:'1',quantity:2}]});
function state(){
  const data=new Map([['owner','fixed-owner']]);let queue=Promise.resolve(),alarm=null;
  const storage={get:async key=>data.get(key),put:async(key,value)=>data.set(key,structuredClone(value)),
    list:async({prefix,limit=1000,startAfter})=>new Map([...data].filter(([key])=>key.startsWith(prefix)&&(!startAfter||key>startAfter)).sort(([a],[b])=>a<b?-1:1).slice(0,limit)),
    delete:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])data.delete(key);},
    getAlarm:async()=>alarm,setAlarm:async value=>{alarm=value;}};
  return {storage,blockConcurrencyWhile:fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;}};
}
const req=(path,body)=>new Request('https://internal'+path,{method:'POST',headers:{'X-Client-Key':'client'},body:JSON.stringify(body)});
const feedback=()=>({requestId:id,kind:'bug',message:'Tôi không tìm thấy sản phẩm cần đặt.',customer:{name:'Khách',phone:''}});

test('history snapshots retain sent prices, newest first, paginate and isolate account prefixes',async()=>{
  const s=state();
  for(let i=0;i<25;i++){
    const snap=historySnapshot(body(),products,1000+i);
    await s.storage.put(snap.key,snap.record);
  }
  const other=historySnapshot({...body(),accountId:'a:other'},products,9999);
  await s.storage.put(other.key,other.record);
  const page=await listHistory(s.storage,{accountId:'a'});
  assert.equal(page.orders.length,20);assert.ok(page.nextCursor);
  assert.equal(page.orders[0].createdAt,new Date(1024).toISOString());
  assert.equal(page.orders[0].items[0].price,21100);
  assert.equal(Object.hasOwn(page.orders[0],'customer'),false);
  const tail=await listHistory(s.storage,{accountId:'a',cursor:page.nextCursor});
  assert.equal(tail.orders.length,5);assert.equal(tail.nextCursor,null);
  assert.equal((await listHistory(s.storage,{accountId:'b'})).orders.length,0);
  await assert.rejects(listHistory(s.storage,{accountId:'a',cursor:'history:a:other'}));
});
test('successful and uncertain deliveries enter history accurately without duplicate sends',async t=>{
  for(const fails of [false,true]){
    let sends=0;
    t.mock.method(globalThis,'fetch',async url=>{
      if(url===env.CATALOGUE_URL)return new Response('window.ANTIN_PRODUCTS='+JSON.stringify(products)+';');
      sends++;if(fails)throw Error('private upstream details');
      return Response.json({ok:true,result:{message_id:'receipt'}});
    });
    const s=state(),receiver=new OrderReceiver(s,env);
    const response=await receiver.fetch(req('/orders',body()));
    assert.equal(response.status,fails?502:200);
    const h=await listHistory(s.storage,{accountId:'a'});
    assert.equal(h.orders.length,1);assert.equal(h.orders[0].status,fails?'uncertain':'sent');
    await receiver.fetch(req('/orders',body()));
    assert.equal(sends,1);assert.equal((await listHistory(s.storage,{accountId:'a'})).orders.length,1);
    t.mock.restoreAll();
  }
});
test('history route always authenticates and ignores a forged account ID',async()=>{
  let forwarded;
  const gateway={...env,ACCOUNTS:{idFromName:()=>1,get:()=>({fetch:async request=>request.headers.get('Authorization')==='Bearer good'
    ?Response.json({ok:true,profile:{id:'real-account',name:'Khách',phone:'0905561550'}})
    :Response.json({error:'auth'}, {status:401})})},
    ORDERS:{idFromName:()=>1,get:()=>({fetch:async request=>{forwarded=await request.json();return Response.json({ok:true,orders:[],nextCursor:null});}})}};
  const call=auth=>worker.fetch(new Request('https://api.test/orders/history',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,Authorization:auth},body:JSON.stringify({accountId:'victim'})}),gateway);
  assert.equal((await call('')).status,401);assert.equal(forwarded,undefined);
  assert.equal((await call('Bearer good')).status,200);assert.equal(forwarded.accountId,'real-account');
});
test('feedback validates size/contact/type and a single bounded message has no client-selected recipient',()=>{
  for(const patch of [{requestId:'bad'},{kind:'order'},{message:'short'},{message:'x'.repeat(1201)},{customer:{phone:'abc'}}])assert.throws(()=>validateFeedback({...feedback(),...patch}));
  const result=validateFeedback({...feedback(),chat_id:'attacker'});
  assert.equal(result.chat_id,undefined);
  assert.match(feedbackMessage(result),/BÁO LỖI WEBSITE/);
  assert.ok(feedbackMessage(validateFeedback({...feedback(),message:'x'.repeat(1200),customer:{name:'x'.repeat(80)}})).length<2000);
});
test('feedback deduplicates concurrent/restarted sends, enforces rate limits and reports uncertain delivery',async t=>{
  for(const fails of [false,true]){
    let sends=0;
    t.mock.method(globalThis,'fetch',async(url,options)=>{
      sends++;assert.equal(JSON.parse(options.body).chat_id,'fixed-owner');
      if(fails)throw Error('private-token');
      return Response.json({ok:true,result:{message_id:'receipt'}});
    });
    const s=state(),receiver=new OrderReceiver(s,env);
    const responses=await Promise.all([receiver.fetch(req('/feedback',feedback())),receiver.fetch(req('/feedback',feedback()))]);
    assert.equal(responses[0].status,fails?502:200);assert.equal(sends,1);
    const retry=await new OrderReceiver(s,env).fetch(req('/feedback',feedback()));
    assert.equal(retry.status,fails?409:200);assert.equal(sends,1);
    assert.equal((await receiver.fetch(req('/feedback',{...feedback(),message:'Nội dung khác hoàn toàn.'}))).status,409);
    assert.equal((await receiver.fetch(req('/feedback',{...feedback(),requestId:'e387f966-064c-4fd5-8f6b-85ea1dc21ac7'}))).status,429);
    t.mock.restoreAll();
  }
});
test('guest feedback is allowed, forged account IDs removed, authenticated identity comes from server',async()=>{
  let forwarded;
  const gateway={...env,ACCOUNTS:{idFromName:()=>1,get:()=>({fetch:async()=>Response.json({ok:true,profile:{id:'real',name:'Verified',phone:'0905561550'}})})},
    ORDERS:{idFromName:()=>1,get:()=>({fetch:async request=>{forwarded=await request.json();return Response.json({ok:true,requestId:id});}})}};
  for(const auth of ['', 'Bearer good']){
    const res=await worker.fetch(new Request('https://api.test/feedback',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,Authorization:auth},body:JSON.stringify({...feedback(),accountId:'forged'})}),gateway);
    assert.equal(res.status,200);assert.equal(forwarded.accountId,auth?'real':undefined);
    if(auth)assert.equal(forwarded.customer.name,'Verified');
  }
});
