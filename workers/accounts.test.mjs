import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,randomUUID} from 'node:crypto';
import {CustomerAccounts,normalizePhone,validateProfile,passwordRecord,verifyPassword} from './accounts.mjs';
import worker from './orders.mjs';

const password=()=>randomUUID()+'Ab';
const profile={name:'Khách kiểm thử',phone:'0905561550',provinceCode:'1',wardCode:'4',address:'12 Phố kiểm thử'};
export function memoryState(){
  const data=new Map();let alarm=null,queue=Promise.resolve();
  return {data,storage:{get:async key=>structuredClone(data.get(key)),put:async(key,value)=>data.set(key,structuredClone(value)),
    delete:async key=>Array.isArray(key)?key.forEach(k=>data.delete(k)):data.delete(key),getAlarm:async()=>alarm,setAlarm:async value=>{alarm=value;},
    list:async({prefix,limit,startAfter})=>new Map([...data].filter(([key])=>key.startsWith(prefix)&&(!startAfter||key>startAfter)).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit))},
    blockConcurrencyWhile:callback=>{const result=queue.then(callback);queue=result.catch(()=>{});return result;}};
}
function client(receiver){return async(action,body={},token='',ip='test-ip')=>{
  const res=await receiver.fetch(new Request('https://internal/auth/'+action,{method:'POST',headers:{'X-Client-Key':ip,Authorization:token?'Bearer '+token:''},body:JSON.stringify(body)}));
  return {status:res.status,...await res.json()};
};}
const registration=(secret,extra={})=>({...profile,password:secret,confirmPassword:secret,consent:true,...extra});

test('canonical phone and province/ward validation; no invented addresses or customer categories',()=>{
  assert.equal(normalizePhone('+84 905 561 550'),profile.phone);
  assert.throws(()=>normalizePhone('12345'));
  assert.equal(validateProfile(profile).province,'Thành phố Hà Nội');
  assert.equal('type' in validateProfile({...profile,type:'admin'}),false);
  assert.throws(()=>validateProfile({...profile,provinceCode:'79',wardCode:'4'}));
});
test('passwords use salted scrypt matching Node crypto, not reversible/plain storage',()=>{
  const secret=password(),record=passwordRecord(secret);
  assert.equal(record.hash,scryptSync(secret,record.salt,32,{N:16384,r:8,p:5}).toString('hex'));
  assert.ok(verifyPassword(secret,record));assert.ok(!verifyPassword(secret+'x',record));
  assert.notEqual(passwordRecord(secret).salt,record.salt);
  assert.ok(!JSON.stringify(record).includes(secret));
});
test('simultaneous registrations cannot claim the same phone twice; responses contain no hashes',async()=>{
  const state=memoryState(),api=client(new CustomerAccounts(state)),secret=password();
  const responses=await Promise.all([api('register',registration(secret)),api('register',registration(secret,{phone:'+84905561550'}))]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  const result=responses.find(r=>r.status===201);
  assert.ok(result.token);assert.ok(!('password' in result.profile));
  assert.ok(!JSON.stringify([...state.data]).includes(secret));
  assert.ok(!JSON.stringify([...state.data]).includes(result.token));
});
test('own profile only, unknown/wrong login uniform, logout invalidates session, expired sessions fail',async()=>{
  const state=memoryState(),api=client(new CustomerAccounts(state)),secret=password();
  const a=await api('register',registration(secret));
  assert.equal((await api('me')).status,401);
  assert.equal((await api('login',{phone:profile.phone,password:'incorrect'})).error,(await api('login',{phone:'0901111111',password:'incorrect'})).error);
  const b=await api('register',registration(secret,{phone:'0901111111',name:'Khách B'}));
  const updated=await api('profile',{...profile,id:b.profile.id,name:'Khách A sửa'},a.token);
  assert.equal(updated.profile.id,a.profile.id);
  assert.equal((await api('me',{},b.token)).profile.name,'Khách B');
  assert.equal((await api('logout',{},a.token)).status,200);
  assert.equal((await api('me',{},a.token)).status,401);
  for(const [key,value] of state.data)if(key.startsWith('session:'))state.data.set(key,{...value,expiresAt:1});
  assert.equal((await api('me',{},b.token)).status,401);
});
test('password change revokes all prior sessions; deletion requires password and removes account data',async()=>{
  const state=memoryState(),api=client(new CustomerAccounts(state)),old=password(),next=password();
  const first=await api('register',registration(old));
  const second=await api('login',{phone:profile.phone,password:old});
  assert.equal((await api('password',{currentPassword:'wrong',password:next,confirmPassword:next},first.token)).status,403);
  const changed=await api('password',{currentPassword:old,password:next,confirmPassword:next},first.token);
  assert.equal(changed.status,200);
  assert.equal((await api('me',{},first.token)).status,401);assert.equal((await api('me',{},second.token)).status,401);
  assert.equal((await api('delete',{currentPassword:'wrong'},changed.token)).status,403);
  assert.equal((await api('delete',{currentPassword:next},changed.token)).status,200);
  assert.equal((await api('me',{},changed.token)).status,401);
  assert.equal([...state.data.keys()].some(key=>key.startsWith('user:')||key.startsWith('phone:')),false);
});
test('rate limits stop repeated credential attempts before more password work',async()=>{
  const state=memoryState(),api=client(new CustomerAccounts(state));
  // Invalid format attempts count against the source IP as well.
  for(let n=0;n<20;n++)assert.equal((await api('login',{phone:'invalid'})).status,400);
  assert.equal((await api('login',{phone:'invalid'})).status,429);
});
test('order endpoint enforces authentication and replaces forged identity with stored profile',async()=>{
  let forwarded;
  const origin='https://shop.test';
  const env={ALLOWED_ORIGIN:origin,REQUIRE_ACCOUNT_LOGIN:'true',ACCOUNTS:{idFromName:x=>x,get:()=>({fetch:async req=>req.headers.get('Authorization')==='Bearer valid'?Response.json({profile:{id:'actual-id',...profile,province:'Hà Nội',ward:'Ba Đình'}}):Response.json({error:'login'},{status:401})})},ORDERS:{idFromName:x=>x,get:()=>({fetch:async req=>{forwarded=await req.json();return Response.json({ok:true});}})}};
  const request=token=>new Request('https://worker.test/orders',{method:'POST',headers:{Origin:origin,Authorization:token},body:JSON.stringify({accountId:'forged',customer:{name:'forged',phone:'123'},items:[]})});
  assert.equal((await worker.fetch(request(''),env)).status,401);assert.equal(forwarded,undefined);
  assert.equal((await worker.fetch(request('Bearer valid'),env)).status,200);
  assert.equal(forwarded.accountId,'actual-id');assert.equal(forwarded.customer.name,profile.name);assert.match(forwarded.customer.address,/Hà Nội/);
});
