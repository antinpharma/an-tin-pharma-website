const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const line = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
export class ServiceError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
export function priceVnd(product,quantity=1) {
  const raw=String(product.price??'').trim();
  const n=/^(?:\d+|\d{1,3}(?:\.\d{3})+)\s*(?:đ|₫|VND)$/i.test(raw)?Number(raw.replace(/\D/g,'')):NaN;
  return Number.isSafeInteger(n)&&n>0&&Number.isSafeInteger(n*quantity)?n:null;
}
const prefix = accountId => 'history:'+encodeURIComponent(accountId)+':';
export function historySnapshot(order,products,time) {
  if(!order.accountId) return null;
  const items=order.items.map(item=>{
    const product=products.find(p=>String(p.productId)===item.productId);
    return {...item,name:line(product.name),price:priceVnd(product,item.quantity)};
  });
  return {key:prefix(order.accountId)+String(9999999999999-time).padStart(13,'0')+':'+order.requestId,
    record:{requestId:order.requestId,createdAt:new Date(time).toISOString(),status:'sending',items}};
}
export async function listHistory(storage,body) {
  if(typeof body.accountId!=='string'||!body.accountId) throw new ServiceError('Vui lòng đăng nhập để xem lịch sử.',401);
  const cursor=body.cursor;
  if(cursor!==undefined&&cursor!==null&&(typeof cursor!=='string'||!/^\d{13}:[0-9a-f-]{36}$/i.test(cursor))) throw new ServiceError('Trang lịch sử không hợp lệ.');
  const p=prefix(body.accountId);
  const entries=await storage.list({prefix:p,limit:21,...(cursor?{startAfter:p+cursor}:{})});
  const page=[...entries].slice(0,20);
  return {ok:true,orders:page.map(([,record])=>record),nextCursor:entries.size>20?page.at(-1)[0].slice(p.length):null};
}
export function validateFeedback(body) {
  if(!uuid.test(body.requestId||'')) throw new ServiceError('Mã góp ý không hợp lệ. Vui lòng mở lại hộp góp ý.');
  if(!['bug','suggestion'].includes(body.kind)) throw new ServiceError('Vui lòng chọn Báo lỗi hoặc Góp ý.');
  const message=String(body.message||'').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').trim();
  if(message.length<10||message.length>1200) throw new ServiceError('Vui lòng nhập nội dung từ 10 đến 1.200 ký tự.');
  const name=line(body.customer?.name),phone=String(body.customer?.phone||'').replace(/[\s().-]/g,'');
  if(name.length>80) throw new ServiceError('Tên tối đa 80 ký tự.');
  if(phone&&!/^(?:0|\+84)[0-9]{9}$/.test(phone)) throw new ServiceError('Số điện thoại liên hệ chưa hợp lệ.');
  return {requestId:body.requestId,kind:body.kind,message,customer:{name,phone},...(body.accountId?{accountId:body.accountId}:{})};
}
export function feedbackMessage(feedback) {
  return `${feedback.kind==='bug'?'BÁO LỖI':'GÓP Ý'} WEBSITE AN TÍN\nMã: ${feedback.requestId}\n`+
    `${feedback.accountId?'Tài khoản: '+feedback.accountId:'Khách chưa đăng nhập'}\n`+
    `Tên: ${feedback.customer.name||'Không cung cấp'}\nSĐT: ${feedback.customer.phone||'Không cung cấp'}\n\n${feedback.message}`;
}
