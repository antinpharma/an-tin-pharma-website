import {CustomerAccounts} from './accounts.mjs';
export {CustomerAccounts};

const MAX_BODY = 16000;
const DAY = 86400000;
const json = (data, status=200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
class OrderError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
const singleLine = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
const money = value => value.toLocaleString('vi-VN')+'đ';

export function validateOrder(body){
  if(!body || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId||'')) throw new OrderError('Mã yêu cầu không hợp lệ. Vui lòng tải lại trang.');
  const name=singleLine(body.customer?.name);
  const phone=String(body.customer?.phone||'').replace(/[\s().-]/g,'');
  if(name.length<2 || name.length>80) throw new OrderError('Vui lòng nhập tên từ 2 đến 80 ký tự.');
  if(!/^(?:0|\+84)[0-9]{9}$/.test(phone)) throw new OrderError('Vui lòng nhập số điện thoại Việt Nam hợp lệ.');
  if(!Array.isArray(body.items) || !body.items.length || body.items.length>50) throw new OrderError('Mỗi yêu cầu cần có từ 1 đến 50 loại sản phẩm.');
  const seen=new Set();
  const items=body.items.map(item=>{
    if(!item || typeof item.productId!=='string' || !item.productId || item.productId.length>100 || seen.has(item.productId)
      || !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>9999) throw new OrderError('Danh sách hoặc số lượng sản phẩm không hợp lệ.');
    seen.add(item.productId);
    return {productId:item.productId,quantity:item.quantity};
  }).sort((a,b)=>a.productId.localeCompare(b.productId));
  const customer={name,phone};
  if(body.customer?.address)customer.address=singleLine(body.customer.address).slice(0,400);
  return {requestId:body.requestId,customer,items,...(body.accountId?{accountId:body.accountId}:{})};
}

export function readCatalogue(source){
  // The price-sync workflow writes JSON inside this assignment. Never evaluate remote JavaScript.
  const match=source.match(/^\s*window\.ANTIN_PRODUCTS\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  let products;
  try{products=JSON.parse(match?.[1]);}catch{throw new OrderError('Chưa đọc được danh mục. Vui lòng thử lại sau.',503);}
  if(!Array.isArray(products) || !products.length) throw new OrderError('Danh mục chưa sẵn sàng.',503);
  const ids=products.filter(p=>p.visible && p.productId).map(p=>String(p.productId));
  if(new Set(ids).size!==ids.length) throw new OrderError('Danh mục cần được kiểm tra lại.',503);
  return products;
}

export function buildMessages(order,products){
  let total=0,unknown=0,quantity=0;
  const lines=order.items.map((item,index)=>{
    const p=products.find(p=>p.visible && String(p.productId)===item.productId);
    if(!p || !p.name) throw new OrderError('Một sản phẩm không còn khả dụng. Vui lòng tải lại danh mục.',409);
    const raw=String(p.price??'').trim();
    const amount=/^(?:\d+|\d{1,3}(?:\.\d{3})+)\s*(?:đ|₫|VND)$/i.test(raw)?Number(raw.replace(/\D/g,'')):NaN;
    const price=Number.isSafeInteger(amount) && amount>0 && Number.isSafeInteger(amount*item.quantity)?amount:null;
    if(price===null) unknown++; else total+=price*item.quantity;
    quantity+=item.quantity;
    return `${index+1}. ${singleLine(p.name).slice(0,150)} (Mã ${item.productId})\nQuy cách: ${singleLine(p.spec||'Cần xác nhận').slice(0,150)}\nSL: ${item.quantity} | Giá: ${price===null?'Liên hệ':money(price)} | Thành tiền: ${price===null?'Liên hệ':money(price*item.quantity)}`;
  });
  if(!Number.isSafeInteger(total)) throw new OrderError('Tạm tính vượt giới hạn. Vui lòng liên hệ trực tiếp.');
  const heading=`YÊU CẦU ĐẶT HÀNG AN TÍN\nMã: ${order.requestId}\nKhách: ${order.customer.name}\nSĐT: ${order.customer.phone}${order.customer.address?'\nĐịa chỉ: '+order.customer.address:''}${order.accountId?'\nMã khách: '+order.accountId:''}`;
  const footer=`Số loại: ${order.items.length} | Tổng SL: ${quantity}\nTạm tính: ${unknown===order.items.length?'Liên hệ':money(total)}${unknown?`\nChưa gồm ${unknown} sản phẩm cần báo giá.`:''}\nVui lòng liên hệ khách để xác nhận giá và tình trạng hàng.`;
  const chunks=[];
  let text=heading;
  for(const line of [...lines,footer]){
    if(text.length+line.length+2>1850){chunks.push(text);text=`Tiếp đơn ${order.requestId}`;}
    text+='\n\n'+line;
  }
  chunks.push(text);
  return chunks.map((text,index)=>`${text}\n[Phần ${index+1}/${chunks.length}]`);
}

async function boundedJson(request){
  const reader=request.body?.getReader();
  if(!reader) throw new OrderError('Thiếu nội dung yêu cầu.');
  const chunks=[];let size=0;
  while(true){
    const {done,value}=await reader.read();if(done) break;
    size+=value.byteLength;
    if(size>MAX_BODY){await reader.cancel();throw new OrderError('Yêu cầu quá lớn.',413);}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new OrderError('Nội dung yêu cầu không hợp lệ.');}
}

async function hash(value){
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}

async function zalo(env,method,data){
  if(!env.ZALO_BOT_TOKEN) throw new OrderError('Kết nối Zalo chưa sẵn sàng.',503);
  const token=String(env.ZALO_BOT_TOKEN).trim();
  if(/^https?:/i.test(token)) throw new OrderError('Secret đang chứa đường dẫn. Cần thay bằng giá trị Bot Token trong tin nhắn Zalo Bot Manager.',503);
  if(/[\s\u0080-\uffff]/.test(token)) throw new OrderError('Secret chứa khoảng trắng hoặc chữ có dấu. Chỉ sao chép mã Bot Token, không kèm nội dung tin nhắn.',503);
  // Let Zalo validate the credential instead of assuming a token format.
  // Encode path delimiters so a malformed value cannot change the destination.
  const tokenPath=encodeURIComponent(token).replace(/%3A/gi,':');
  try{
    const res=await fetch(`https://bot-api.zaloplatforms.com/bot${tokenPath}/${method}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(method==='getUpdates'?35000:8000),redirect:'manual'
    });
    let result;
    try{result=await res.json();}catch{throw new OrderError(`Zalo chưa trả dữ liệu hợp lệ (HTTP ${res.status}).`,502);}
    if(!res.ok || result.ok!==true){
      const code=Number.isInteger(result.error_code)?`, mã ${result.error_code}`:'';
      throw new OrderError(`Zalo từ chối kết nối (HTTP ${res.status}${code}).`,502);
    }
    return result.result;
  }catch(error){
    if(error instanceof OrderError) throw error;
    // Never include upstream URLs, response bodies or tokens in logs or errors.
    const reason=['TimeoutError','AbortError','TypeError'].includes(error?.name)?` (${error.name})`:'';
    throw new OrderError(`Chưa xác nhận được phản hồi từ Zalo${reason}.`,502);
  }
}

export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    const origin=request.headers.get('Origin');
    const admin=path.startsWith('/admin/');
    const cors={'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'};
    if(!admin && origin!==env.ALLOWED_ORIGIN) return json({error:'Nguồn yêu cầu không hợp lệ.'},403);
    if(!admin && request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
    let response;
    try{
      if(request.method!=='POST') throw new OrderError('Chỉ hỗ trợ POST.',405);
      if(admin && (!env.ZALO_SETUP_KEY || request.headers.get('Authorization')!==`Bearer ${env.ZALO_SETUP_KEY}`)) throw new OrderError('Không có quyền truy cập.',403);
      const authPaths=['/auth/register','/auth/login','/auth/me','/auth/logout','/auth/profile','/auth/password','/auth/delete'];
      if(!['/orders','/admin/check','/admin/pair',...authPaths].includes(path)) throw new OrderError('Không tìm thấy.',404);
      const body=await boundedJson(request);
      const headers={'Content-Type':'application/json','X-Client-Key':await hash(request.headers.get('CF-Connecting-IP')||'unknown'),Authorization:request.headers.get('Authorization')||''};
      if(authPaths.includes(path)){
        const accounts=env.ACCOUNTS.get(env.ACCOUNTS.idFromName('customer-accounts'));
        response=await accounts.fetch(new Request('https://internal'+path,{method:'POST',headers,body:JSON.stringify(body)}));
      }else{
        delete body.accountId;
        if(path==='/orders'&&(env.REQUIRE_ACCOUNT_LOGIN==='true'||headers.Authorization)){
          const accounts=env.ACCOUNTS.get(env.ACCOUNTS.idFromName('customer-accounts'));
          const auth=await accounts.fetch(new Request('https://internal/auth/me',{method:'POST',headers,body:'{}'}));
          if(!auth.ok)throw new OrderError('Vui lòng đăng nhập tài khoản để gửi yêu cầu đặt hàng.',auth.status===429?429:401);
          const {profile}=await auth.json();
          body.accountId=profile.id;
          body.customer={name:profile.name,phone:profile.phone,address:[profile.address,profile.ward,profile.province].join(', ')};
        }
        const stub=env.ORDERS.get(env.ORDERS.idFromName('antin-order-receiver'));
        response=await stub.fetch(new Request('https://internal'+path,{method:'POST',headers,body:JSON.stringify(body)}));
      }
    }catch(error){response=json({error:error instanceof OrderError?error.message:'Dịch vụ tạm thời chưa sẵn sàng.'},error instanceof OrderError?error.status:503);}
    if(admin) return response;
    const headers=new Headers(response.headers);
    for(const [key,value] of Object.entries(cors)) headers.set(key,value);
    return new Response(response.body,{status:response.status,headers});
  }
};

export class OrderReceiver {
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(request){
    try{
      const path=new URL(request.url).pathname,body=await request.json();
      if(path==='/admin/check'){
        const bot=await zalo(this.env,'getMe',{});
        if(String(bot.id)!==this.env.EXPECTED_BOT_ID) return json({ok:false,error:'ID do API Zalo trả về khác ID đang cấu hình.',botId:String(bot.id),accountName:singleLine(bot.account_name),paired:!!await this.state.storage.get('owner')},409);
        return json({ok:true,botId:String(bot.id),paired:!!await this.state.storage.get('owner')});
      }
      if(path==='/admin/pair'){
        if(!/^ANTIN-[A-Z0-9]{12,32}$/.test(body.code||'')) throw new OrderError('Mã xác minh không hợp lệ.');
        if(await this.state.storage.get('owner')) throw new OrderError('Bot đã có tài khoản nhận đơn.',409);
        const bot=await zalo(this.env,'getMe',{});
        if(String(bot.id)!==this.env.EXPECTED_BOT_ID) throw new OrderError('Sai bot.',409);
        const result=await zalo(this.env,'getUpdates',{timeout:'30'});
        const updates=Array.isArray(result)?result:[result];
        const message=updates.map(update=>update?.message).find(message=>message?.text?.trim()===body.code && message.chat?.id && message.chat?.chat_type==='PRIVATE');
        if(!message) return json({ok:false,error:'Chưa thấy mã xác minh trong tin nhắn riêng gửi cho bot.'},409);
        await this.state.blockConcurrencyWhile(async()=>{
          if(await this.state.storage.get('owner')) throw new OrderError('Bot đã có tài khoản nhận đơn.',409);
          await this.state.storage.put('owner',String(message.chat.id));
        });
        return json({ok:true,paired:true});
      }
      // Serialize the receipt reservation and provider call: duplicate submits cannot send twice.
      return await this.state.blockConcurrencyWhile(async()=>{
        try{return await this.receive(body,request.headers.get('X-Client-Key'));}
        catch(error){return json({error:error instanceof OrderError?error.message:'Dịch vụ tạm thời chưa sẵn sàng.'},error instanceof OrderError?error.status:503);}
      });
    }catch(error){return json({error:error instanceof OrderError?error.message:'Dịch vụ tạm thời chưa sẵn sàng.'},error instanceof OrderError?error.status:503);}
  }
  async receive(body,clientKey){
    const order=validateOrder(body),owner=await this.state.storage.get('owner');
    if(!owner) throw new OrderError('Dịch vụ nhận đơn đang được thiết lập. Vui lòng liên hệ Zalo trực tiếp.',503);
    const fingerprint=await hash(JSON.stringify(order)),key='order:'+order.requestId;
    const previous=await this.state.storage.get(key);
    if(previous){
      if(previous.hash!==fingerprint) throw new OrderError('Mã yêu cầu đã dùng cho nội dung khác.',409);
      if(previous.status==='sent') return json({ok:true,requestId:order.requestId});
      return json({error:'Yêu cầu này chưa xác nhận gửi đủ. Vui lòng liên hệ Zalo và cung cấp mã yêu cầu để kiểm tra.',requestId:order.requestId,uncertain:true},409);
    }
    const rateKey='rate:'+clientKey,now=Date.now();
    const rate=await this.state.storage.get(rateKey);
    if(rate && now-rate.time<60000 && rate.count>=3) throw new OrderError('Bạn đã gửi nhiều yêu cầu. Vui lòng chờ một phút.',429);
    await this.state.storage.put(rateKey,{time:rate && now-rate.time<60000?rate.time:now,count:rate && now-rate.time<60000?rate.count+1:1});
    if(!await this.state.storage.getAlarm()) await this.state.storage.setAlarm(now+DAY);
    const res=await fetch(this.env.CATALOGUE_URL,{signal:AbortSignal.timeout(5000),redirect:'manual',cache:'no-store'});
    if(!res.ok) throw new OrderError('Chưa kiểm tra được danh mục hiện hành.',503);
    const messages=buildMessages(order,readCatalogue(await res.text()));
    // Keep provider calls inside the Durable Object's 30-second critical section.
    if(messages.length>2) throw new OrderError('Danh sách quá dài. Vui lòng chia thành các yêu cầu nhỏ hơn.');
    await this.state.storage.put(key,{hash:fingerprint,status:'sending',time:now});
    try{
      for(const text of messages){
        const result=await zalo(this.env,'sendMessage',{chat_id:owner,text});
        if(!result?.message_id) throw new Error('Missing receipt');
      }
      await this.state.storage.put(key,{hash:fingerprint,status:'sent',time:now});
      return json({ok:true,requestId:order.requestId});
    }catch{
      return json({error:'Chưa xác nhận gửi đủ danh sách. Vui lòng liên hệ Zalo và cung cấp mã yêu cầu để kiểm tra.',requestId:order.requestId,uncertain:true},502);
    }
  }
  async alarm(){
    const now=Date.now();
    // Receipts contain only a hash/status, never customer names, phone numbers or order contents.
    for(const prefix of ['order:','rate:']){
      let startAfter;
      do{
        const entries=await this.state.storage.list({prefix,limit:500,...(startAfter?{startAfter}:{})});
        const expired=[...entries].filter(([,item])=>now-item.time>(prefix==='order:'?30*DAY:DAY)).map(([key])=>key);
        if(expired.length) await this.state.storage.delete(expired);
        startAfter=entries.size===500?[...entries.keys()].at(-1):null;
      }while(startAfter);
    }
    await this.state.storage.setAlarm(now+DAY);
  }
}
