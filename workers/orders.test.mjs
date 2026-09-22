import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker,{OrderReceiver,validateOrder,readCatalogue,buildMessages} from './orders.mjs';

const id='e387f966-064c-4fd5-8f6b-85ea1dc21ac6';
const body=()=>({requestId:id,customer:{name:'Khách thử',phone:'0905561550'},items:[{productId:'1146',quantity:2}]});
const products=[{productId:'1146',name:'Klenzit-C Gel',spec:'Tuýp 15g',price:'113.000đ',visible:true},{productId:'1505',name:'Nexium',price:'Liên hệ',visible:true}];

test('validate ID, customer, quantity and duplicate product IDs; ignore client prices and recipients',()=>{
  const input={...body(),chat_id:'attacker',text:'forged',price:1};
  assert.deepEqual(validateOrder(input),body());
  for(const items of [[],[{productId:'1146',quantity:0}],[{productId:'1146',quantity:1.5}],[{productId:'1146',quantity:10000}],[body().items[0],body().items[0]]]) assert.throws(()=>validateOrder({...body(),items}));
  assert.throws(()=>validateOrder({...body(),customer:{name:'X',phone:'abc'}}));
});
test('catalogue source is data, never executed; production catalogue remains readable',async()=>{
  assert.deepEqual(readCatalogue('window.ANTIN_PRODUCTS = '+JSON.stringify(products)+';'),products);
  assert.throws(()=>readCatalogue('window.ANTIN_PRODUCTS = [process.exit()];'));
  assert.throws(()=>readCatalogue('window.ANTIN_PRODUCTS = '+JSON.stringify([products[0],products[0]])+';'));
  assert.ok(readCatalogue(await readFile(new URL('../catalogue.js',import.meta.url),'utf8')).length);
});
test('authoritative prices and uncertain prices; rejects unavailable products',()=>{
  let text=buildMessages(validateOrder(body()),products).join('\n');
  assert.match(text,/226.000đ/);
  const order=validateOrder({...body(),items:[...body().items,{productId:'1505',quantity:3}]});
  text=buildMessages(order,products).join('\n');
  assert.match(text,/Chưa gồm 1 sản phẩm cần báo giá/);
  assert.match(text,/Tạm tính: 226.000đ/);
  assert.throws(()=>buildMessages(order,products.slice(0,1)));
});
test('large orders split into messages below the Zalo length limit',()=>{
  const many=Array.from({length:30},(_,i)=>({...products[0],productId:String(i),name:'Sản phẩm '.repeat(25),spec:'Quy cách '.repeat(25)}));
  const order=validateOrder({...body(),items:many.map(p=>({productId:p.productId,quantity:1}))});
  const parts=buildMessages(order,many);
  assert.ok(parts.length>1);
  assert.ok(parts.every(text=>text.length<=2000));
  for(const p of many) assert.ok(parts.some(text=>text.includes(`(Mã ${p.productId})`)));
});

function state(owner='owner-private-chat'){
  const data=new Map(owner?[['owner',owner]]:[]);
  let alarm=null,queue=Promise.resolve();
  return {storage:{get:async key=>data.get(key),put:async(key,value)=>data.set(key,value),getAlarm:async()=>alarm,setAlarm:async value=>{alarm=value;}},
    blockConcurrencyWhile:callback=>{const result=queue.then(callback);queue=result.catch(()=>{});return result;}};
}
const env={ZALO_BOT_TOKEN:'123:test-token-not-real',CATALOGUE_URL:'https://catalogue.test/catalogue.js',ALLOWED_ORIGIN:'https://shop.test'};
const request=(data=body())=>new Request('https://internal/orders',{method:'POST',headers:{'X-Client-Key':'client'},body:JSON.stringify(data)});

test('concurrent duplicate submission sends only once and reports confirmed delivery',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(options.redirect,'manual');
    if(url===env.CATALOGUE_URL) return new Response('window.ANTIN_PRODUCTS = '+JSON.stringify(products)+';');
    calls++;
    const payload=JSON.parse(options.body);
    assert.equal(payload.chat_id,'owner-private-chat');
    assert.match(payload.text,/226.000đ/);
    return Response.json({ok:true,result:{message_id:'receipt'}});
  });
  const receiver=new OrderReceiver(state(),env);
  const responses=await Promise.all([receiver.fetch(request()),receiver.fetch(request())]);
  assert.deepEqual(await Promise.all(responses.map(res=>res.json())),[{ok:true,requestId:id},{ok:true,requestId:id}]);
  assert.equal(calls,1);
  const conflict=await receiver.fetch(request({...body(),customer:{...body().customer,name:'Another'}}));
  assert.equal(conflict.status,409);
});
test('network ambiguity never reports success or blindly resends; token stays out of errors',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async url=>{
    if(url===env.CATALOGUE_URL) return new Response('window.ANTIN_PRODUCTS = '+JSON.stringify(products)+';');
    calls++;throw new Error('Private token '+env.ZALO_BOT_TOKEN);
  });
  const receiver=new OrderReceiver(state(),env);
  const first=await receiver.fetch(request());
  assert.equal(first.status,502);
  const result=await first.json();assert.equal(result.uncertain,true);
  assert.ok(!JSON.stringify(result).includes(env.ZALO_BOT_TOKEN));
  assert.equal((await receiver.fetch(request())).status,409);
  assert.equal(calls,1);
});
test('requests from other origins and unauthenticated admin calls are rejected before provider access',async()=>{
  assert.equal((await worker.fetch(new Request('https://worker.test/orders',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}),env)).status,403);
  assert.equal((await worker.fetch(new Request('https://worker.test/admin/check',{method:'POST',body:'{}'}),env)).status,403);
  const preflight=await worker.fetch(new Request('https://worker.test/orders',{method:'OPTIONS',headers:{Origin:env.ALLOWED_ORIGIN}}),env);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),env.ALLOWED_ORIGIN);
});

test('pairing requires the selected bot and exact code in a private chat; cannot replace an owner',async t=>{
  const code='ANTIN-0123456789AB',storage=state(null);
  let botId='wrong-bot',message={text:code,chat:{id:'owner',chat_type:'PRIVATE'}};
  t.mock.method(globalThis,'fetch',async url=>Response.json({ok:true,result:url.endsWith('/getMe')?{id:botId}:{message}}));
  const receiver=new OrderReceiver(storage,{...env,EXPECTED_BOT_ID:'576169620734670481'});
  const pair=()=>receiver.fetch(new Request('https://internal/admin/pair',{method:'POST',body:JSON.stringify({code})}));
  assert.equal((await pair()).status,409);
  assert.equal(await storage.storage.get('owner'),undefined);
  botId='576169620734670481';message.chat.chat_type='GROUP';
  assert.equal((await pair()).status,409);
  message.chat.chat_type='PRIVATE';message.text='a different code';
  assert.equal((await pair()).status,409);
  message.text=code;
  assert.deepEqual(await (await pair()).json(),{ok:true,paired:true});
  assert.equal(await storage.storage.get('owner'),'owner');
  message.chat.id='replacement';
  assert.equal((await pair()).status,409);
  assert.equal(await storage.storage.get('owner'),'owner');
});

test('token diagnostics reject a link without revealing it and accept URL-encoded secret characters',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async url=>{
    calls++;
    assert.equal(url,'https://bot-api.zaloplatforms.com/bot123/never');
  });
  const check=receiver=>receiver.fetch(new Request('https://internal/admin/check',{method:'POST',body:'{}'}));
  const badToken='https://private.test/not-a-token';
  const result=await (await check(new OrderReceiver(state(),{...env,ZALO_BOT_TOKEN:badToken}))).json();
  assert.match(result.error,/đường dẫn/);
  assert.ok(!JSON.stringify(result).includes(badToken));
  assert.equal(calls,0);
  t.mock.method(globalThis,'fetch',async url=>{
    assert.equal(url,'https://bot-api.zaloplatforms.com/bot123:secret%2B%2F%3D/getMe');
    return Response.json({ok:true,result:{id:'123'}});
  });
  assert.equal((await check(new OrderReceiver(state(),{...env,ZALO_BOT_TOKEN:'123:secret+/=',EXPECTED_BOT_ID:'123'}))).status,200);
});
