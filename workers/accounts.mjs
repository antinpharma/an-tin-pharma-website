import {scrypt} from '@noble/hashes/scrypt.js';
import locations from '../data/locations.json' with {type:'json'};

const HOUR=3600000,DAY=24*HOUR;
const options={N:16384,r:8,p:5,dkLen:32}; // OWASP scrypt memory/CPU trade-off: 16 MiB.
const encoder=new TextEncoder();
const hex=bytes=>[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
const randomHex=length=>hex(crypto.getRandomValues(new Uint8Array(length)));
const digest=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
const clean=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim():'';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export class AccountError extends Error{constructor(message,status=400){super(message);this.status=status;}}

export function normalizePhone(value){
  const phone=clean(value).replace(/[\s().-]/g,'').replace(/^\+84/,'0');
  if(!/^0[35789]\d{8}$/.test(phone))throw new AccountError('Vui lòng nhập số điện thoại di động Việt Nam hợp lệ.');
  return phone;
}
export function validateProfile(body){
  const name=clean(body.name),address=clean(body.address);
  const province=locations.provinces.find(p=>p.code===String(body.provinceCode));
  const ward=province?.wards.find(w=>w.code===String(body.wardCode));
  if(name.length<2||name.length>80)throw new AccountError('Họ tên cần từ 2 đến 80 ký tự.');
  if(!province||!ward)throw new AccountError('Vui lòng chọn tỉnh/thành phố và xã/phường tương ứng.');
  if(address.length<5||address.length>200)throw new AccountError('Địa chỉ cụ thể cần từ 5 đến 200 ký tự.');
  return {name,provinceCode:province.code,province:province.name,wardCode:ward.code,ward:ward.name,address};
}
export function validatePassword(password){
  if(typeof password!=='string'||password.length<12||password.length>128)throw new AccountError('Mật khẩu cần từ 12 đến 128 ký tự. Bạn có thể dùng một câu dễ nhớ.');
  return password;
}
export function passwordRecord(password){
  const salt=randomHex(16);
  return {algorithm:'scrypt-16384-8-5',salt,hash:hex(scrypt(encoder.encode(validatePassword(password)),encoder.encode(salt),options))};
}
export function verifyPassword(password,record){
  if(typeof password!=='string'||password.length>128||!record)return false;
  const actual=hex(scrypt(encoder.encode(password),encoder.encode(record.salt),options));
  let mismatch=actual.length^record.hash.length;
  for(let i=0;i<actual.length;i++)mismatch|=actual.charCodeAt(i)^(record.hash.charCodeAt(i)||0);
  return mismatch===0;
}
const publicProfile=user=>({id:user.id,phone:user.phone,...user.profile});

export class CustomerAccounts{
  constructor(state){this.state=state;}
  async fetch(request){
    // Catch expected validation/auth errors inside the gate: a thrown callback
    // resets a real Durable Object and aborts the response.
    return this.state.blockConcurrencyWhile(async()=>{
      try{return await this.handle(request);}
      catch(error){return json({error:error instanceof AccountError?error.message:'Dịch vụ tài khoản tạm thời chưa sẵn sàng.'},error instanceof AccountError?error.status:503);}
    });
  }
  async rate(key,limit,windowMs){
    const now=Date.now(),storage=this.state.storage;
    const previous=await storage.get('rate:'+key);
    const record=previous&&previous.until>now?previous:{count:0,until:now+windowMs};
    if(record.count>=limit)throw new AccountError('Bạn đã thử nhiều lần. Vui lòng chờ ít phút rồi thử lại.',429);
    record.count++;await storage.put('rate:'+key,record);
    if(!await storage.getAlarm())await storage.setAlarm(now+DAY);
  }
  async session(request){
    const authorization=request.headers.get('Authorization')||'';
    if(!/^Bearer [a-f0-9]{64}$/.test(authorization))throw new AccountError('Vui lòng đăng nhập để tiếp tục.',401);
    const key='session:'+await digest(authorization.slice(7));
    const session=await this.state.storage.get(key);
    if(!session||session.expiresAt<=Date.now())throw new AccountError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',401);
    const user=await this.state.storage.get('user:'+session.userId);
    if(!user)throw new AccountError('Phiên đăng nhập không còn hiệu lực.',401);
    return {user,key,session};
  }
  async createSession(user){
    const token=randomHex(32),key='session:'+await digest(token),expiresAt=Date.now()+8*HOUR;
    const sessions=user.sessions||[];
    while(sessions.length>=5)await this.state.storage.delete(sessions.shift());
    sessions.push(key);user.sessions=sessions;
    await this.state.storage.put('user:'+user.id,user);
    await this.state.storage.put(key,{userId:user.id,expiresAt});
    if(!await this.state.storage.getAlarm())await this.state.storage.setAlarm(Date.now()+DAY);
    return {ok:true,token,expiresAt,profile:publicProfile(user)};
  }
  async revoke(user){for(const key of user.sessions||[])await this.state.storage.delete(key);user.sessions=[];}
  async handle(request){
    const path=new URL(request.url).pathname,body=await request.json(),storage=this.state.storage;
    const client=request.headers.get('X-Client-Key')||'unknown';
    if(path==='/auth/register'||path==='/auth/login'){
      await this.rate('entry:'+client,20,15*60000);
      const phone=normalizePhone(body.phone),phoneKey='phone:'+await digest(phone);
      await this.rate('phone:'+await digest(phone),10,15*60000);
      if(path==='/auth/register'){
        await this.rate('register:'+client,5,DAY);
        const profile=validateProfile(body);
        validatePassword(body.password);
        if(body.password!==body.confirmPassword)throw new AccountError('Mật khẩu nhập lại chưa trùng khớp.');
        if(body.consent!==true)throw new AccountError('Vui lòng đồng ý lưu thông tin để tạo tài khoản.');
        if(await storage.get(phoneKey))throw new AccountError('Không thể đăng ký số này. Hãy thử đăng nhập hoặc liên hệ An Tín để được hỗ trợ.',409);
        const user={id:crypto.randomUUID(),phone,profile,password:passwordRecord(body.password),createdAt:Date.now(),sessions:[]};
        // Serialize uniqueness check + writes in the Durable Object.
        await storage.put('user:'+user.id,user);await storage.put(phoneKey,user.id);
        return json(await this.createSession(user),201);
      }
      const id=await storage.get(phoneKey),user=id?await storage.get('user:'+id):null;
      // A fixed dummy record gives unknown phones the same password hashing work.
      const record=user?.password||{salt:'00000000000000000000000000000000',hash:'0'.repeat(64)};
      const valid=verifyPassword(body.password,record);
      if(!valid||!user)throw new AccountError('Số điện thoại hoặc mật khẩu chưa đúng.',401);
      return json(await this.createSession(user));
    }
    await this.rate('session:'+client,100,60000);
    const {user,key,session}=await this.session(request);
    if(path==='/auth/me')return json({ok:true,profile:publicProfile(user),expiresAt:session.expiresAt});
    if(path==='/auth/logout'){
      await storage.delete(key);user.sessions=user.sessions.filter(value=>value!==key);await storage.put('user:'+user.id,user);
      return json({ok:true});
    }
    if(path==='/auth/profile'){
      user.profile=validateProfile(body);await storage.put('user:'+user.id,user);
      return json({ok:true,profile:publicProfile(user)});
    }
    if(path==='/auth/password'||path==='/auth/delete'){
      await this.rate('password:'+user.id,5,15*60000);
      if(!verifyPassword(body.currentPassword,user.password))throw new AccountError('Mật khẩu hiện tại chưa đúng.',403);
      if(path==='/auth/delete'){
        await this.revoke(user);await storage.delete('user:'+user.id);await storage.delete('phone:'+await digest(user.phone));
        return json({ok:true});
      }
      validatePassword(body.password);
      if(body.password!==body.confirmPassword)throw new AccountError('Mật khẩu nhập lại chưa trùng khớp.');
      user.password=passwordRecord(body.password);await this.revoke(user);
      return json(await this.createSession(user));
    }
    throw new AccountError('Không tìm thấy chức năng tài khoản.',404);
  }
  async alarm(){
    const now=Date.now();
    for(const prefix of ['session:','rate:']){
      let startAfter;
      do{
        const rows=await this.state.storage.list({prefix,limit:500,...(startAfter?{startAfter}:{})});
        const keys=[...rows].filter(([,v])=>(v.expiresAt||v.until)<=now).map(([key])=>key);
        if(keys.length)await this.state.storage.delete(keys);
        startAfter=rows.size===500?[...rows.keys()].at(-1):null;
      }while(startAfter);
    }
    await this.state.storage.setAlarm(now+DAY);
  }
}
