const CONFIG = window.ANTIN_CONFIG || {};

const FALLBACK_PRODUCTS = (Array.isArray(window.ANTIN_PRODUCTS) && window.ANTIN_PRODUCTS.length)
  ? window.ANTIN_PRODUCTS.map(p => ({...p}))
  : [
      {name:'Nexium 40mg',category:'Thuốc',spec:'Hộp 28 viên',price:'Liên hệ',active:'Esomeprazole 40mg',indication:'Thông tin tham khảo. Vui lòng liên hệ An Tín Pharma để được tư vấn thêm.',image:'',visible:true},
      {name:'Xatral XL 10mg',category:'Thuốc',spec:'Hộp 30 viên',price:'Liên hệ',active:'Alfuzosin hydrochloride 10mg',indication:'Thông tin tham khảo. Vui lòng liên hệ An Tín Pharma để được tư vấn thêm.',image:'',visible:true}
    ];

let products = [...FALLBACK_PRODUCTS];
let categories = ['Tất cả'];
let activeCategory = 'Tất cả';
const CART_STORAGE_KEY = 'antin-cart-v1';
const MAX_QUANTITY = 9999;
let cart = new Map();
let orderSending=false;
let orderSubmitted=false;
let memoryOrderAttempt=null;

function stripAccents(s=''){
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');
}
function keyify(s=''){
  return stripAccents(s).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}
function parseCSV(text){
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(ch === '"'){
      if(quoted && next === '"'){ cell += '"'; i++; } else quoted = !quoted;
    } else if(ch === ',' && !quoted){
      row.push(cell); cell='';
    } else if((ch === '\n' || ch === '\r') && !quoted){
      if(ch === '\r' && next === '\n') i++;
      row.push(cell); cell='';
      if(row.some(v => v.trim() !== '')) rows.push(row);
      row=[];
    } else cell += ch;
  }
  row.push(cell);
  if(row.some(v => v.trim() !== '')) rows.push(row);
  if(!rows.length) return [];
  const headers = rows.shift().map(keyify);
  return rows.map(r => Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])));
}
function sheetCsvUrl(url, sheetName){
  if(!url) return '';
  if(url.includes('gviz/tq') || url.includes('output=csv')) return url;
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if(!m) return '';
  return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName || 'San pham')}`;
}
function pick(row, ...aliases){
  for(const a of aliases){
    const k=keyify(a);
    if(row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
}
function normalizePrice(v){
  const s=String(v||'').trim();
  if(!s) return 'Liên hệ';
  if(/lien he/i.test(stripAccents(s))) return 'Liên hệ';
  const digits=s.replace(/[^0-9]/g,'');
  return digits ? Number(digits).toLocaleString('vi-VN')+'đ' : s;
}
function normalizeImage(url){
  const s=String(url||'').trim();
  if(!s) return '';
  const m1=s.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  const m2=s.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  const id=m1?.[1] || m2?.[1];
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : s;
}
function rowToProduct(r){
  const visibleRaw = pick(r,'Hiển thị','hien_thi','visible','show');
  return {
    productId: pick(r,'Product ID','product_id','Mã sản phẩm','ma_san_pham','id'),
    name: pick(r,'Tên sản phẩm','ten_san_pham','Tên','name','product_name'),
    brand: pick(r,'Brand','brand','Hãng','hang'),
    category: pick(r,'Danh mục','danh_muc','category') || 'Khác',
    spec: pick(r,'Quy cách','quy_cach','spec'),
    price: normalizePrice(pick(r,'Giá','gia','price')),
    active: pick(r,'Hoạt chất','hoat_chat','active'),
    indication: pick(r,'Chỉ định','chi_dinh','Thông tin','thong_tin','indication'),
    image: normalizeImage(pick(r,'Ảnh','anh','Hình ảnh','hinh_anh','image')),
    visible: visibleRaw === '' || !['0','false','an','no'].includes(stripAccents(visibleRaw).toLowerCase())
  };
}
function esc(s){
  return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function rebuildCategories(){
  const list=[...new Set(products.filter(p=>p.visible).map(p=>p.category).filter(Boolean))];
  categories=['Tất cả',...list];
  if(!categories.includes(activeCategory)) activeCategory='Tất cả';
}
function renderCategories(){
  document.getElementById('categories').innerHTML=categories.map(c=>`<button class="chip ${c===activeCategory?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{activeCategory=b.dataset.cat;renderCategories();renderProducts();}));
}
function productKey(p){
  return p.productId ? `id:${p.productId}` : `item:${JSON.stringify([p.name,p.spec,p.brand])}`;
}
function findProduct(key){
  return products.find(p=>p.visible && productKey(p)===key);
}
function money(value){
  return value.toLocaleString('vi-VN')+'đ';
}
function unitPrice(p){
  // Only accept an unambiguous whole-dong catalogue price. Never guess a price.
  const value=String(p.price ?? '').trim();
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)\s*(?:đ|₫|VND)$/i.test(value)) return null;
  const number=Number(value.replace(/\D/g,''));
  return Number.isSafeInteger(number) && number>0 && Number.isSafeInteger(number*MAX_QUANTITY) ? number : null;
}
function restoreCart(){
  try{
    const saved=JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if(!Array.isArray(saved)) return new Map();
    return new Map(saved.filter(item=>item && typeof item.key==='string' && findProduct(item.key)
      && Number.isInteger(item.quantity) && item.quantity>0 && item.quantity<=MAX_QUANTITY)
      .map(item=>[item.key,{quantity:item.quantity,selected:item.selected!==false}]));
  }catch{ return new Map(); }
}
function saveCart(){
  try{
    localStorage.setItem(CART_STORAGE_KEY,JSON.stringify([...cart].map(([key,item])=>({key,...item}))));
  }catch{
    document.getElementById('cartAnnouncement').textContent='Trình duyệt không lưu được giỏ hàng. Lựa chọn vẫn được giữ trong lần mở trang này.';
  }
}
function cartRows(selectedOnly=false){
  return [...cart].flatMap(([key,item])=>{
    const product=findProduct(key);
    return product && (!selectedOnly || item.selected) ? [{key,...item,product}] : [];
  });
}
function totals(rows){
  return rows.reduce((result,row)=>{
    const price=unitPrice(row.product);
    result.quantity+=row.quantity;
    if(price===null) result.unknown++;
    else result.amount+=price*row.quantity;
    return result;
  },{quantity:0,amount:0,unknown:0});
}
function totalLabel(rows){
  const summary=totals(rows);
  return summary.unknown===rows.length && rows.length ? 'Liên hệ' : money(summary.amount);
}
function productImage(p){
  return p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`
    : '<span class="image-placeholder">Ảnh sản phẩm</span>';
}
function quantityControl(p){
  const key=productKey(p), quantity=cart.get(key)?.quantity || 0;
  return `<div class="quantity-control" data-quantity-key="${esc(key)}">
    <button type="button" data-cart-action="decrease" data-key="${esc(key)}" aria-label="Giảm số lượng ${esc(p.name)}" ${quantity===0?'disabled':''}>−</button>
    <input type="number" min="0" max="${MAX_QUANTITY}" step="1" inputmode="numeric" value="${quantity}" data-cart-action="quantity" data-key="${esc(key)}" aria-label="Số lượng ${esc(p.name)}">
    <button type="button" data-cart-action="increase" data-key="${esc(key)}" aria-label="Tăng số lượng ${esc(p.name)}" ${quantity===MAX_QUANTITY?'disabled':''}>+</button>
  </div>`;
}
function syncQuantityControls(){
  document.querySelectorAll('[data-quantity-key]').forEach(control=>{
    const quantity=cart.get(control.dataset.quantityKey)?.quantity || 0;
    control.querySelector('input').value=quantity;
    control.querySelector('[data-cart-action="decrease"]').disabled=quantity===0;
    control.querySelector('[data-cart-action="increase"]').disabled=quantity===MAX_QUANTITY;
    control.closest('.card')?.classList.toggle('in-cart',quantity>0);
  });
}
function setQuantity(key,quantity){
  if(orderSending) return;
  const product=findProduct(key);
  if(!product) return;
  const existed=cart.has(key);
  if(!Number.isInteger(quantity) || quantity<0 || quantity>MAX_QUANTITY){
    syncQuantityControls();
    document.getElementById('cartAnnouncement').textContent=`Nhập số lượng nguyên từ 0 đến ${MAX_QUANTITY}.`;
    return;
  }
  if(quantity===0) cart.delete(key);
  else cart.set(key,{quantity,selected:cart.get(key)?.selected ?? true});
  resetOrderFeedback();
  document.getElementById('cartAnnouncement').textContent=`${product.name}: ${quantity===0?'đã xoá khỏi giỏ hàng':`số lượng ${quantity}`}.`;
  saveCart();
  renderCart(!existed || quantity===0);
}
function orderText(rows){
  if(!rows.length) return '';
  const lines=rows.map((row,index)=>{
    const p=row.product, price=unitPrice(p);
    return `${index+1}. ${p.name}${p.productId?` (Mã: ${p.productId})`:''}\n   Quy cách: ${p.spec||'Cần xác nhận'}\n   Số lượng: ${row.quantity} | Đơn giá: ${price===null?'Liên hệ':money(price)} | Thành tiền: ${price===null?'Liên hệ':money(price*row.quantity)}`;
  });
  const summary=totals(rows);
  return `Chào An Tín Pharma, tôi muốn hỏi đặt các sản phẩm sau:\n\n${lines.join('\n\n')}\n\nSố loại: ${rows.length} | Tổng số lượng: ${summary.quantity}\nTạm tính${summary.unknown?' (chỉ sản phẩm có giá)':''}: ${totalLabel(rows)}${summary.unknown?`\nCó ${summary.unknown} sản phẩm cần báo giá.`:''}\nVui lòng xác nhận giá và tình trạng hàng. Cảm ơn!`;
}
function renderCart(refreshItems=true){
  const rows=cartRows(), selected=rows.filter(row=>row.selected), summary=totals(selected), allTotals=totals(rows);
  const active=document.activeElement;
  const focus=refreshItems && active?.closest('#cartItems') ? {key:active.dataset.key,action:active.dataset.cartAction} : null;
  document.getElementById('cartBadge').textContent=allTotals.quantity;
  document.getElementById('cartToggle').setAttribute('aria-label',`Giỏ hàng, tổng số lượng ${allTotals.quantity}`);
  document.getElementById('cartBar').hidden=!rows.length;
  document.body.classList.toggle('has-cart',rows.length>0);
  document.getElementById('cartBarCount').textContent=`${rows.length} loại · Số lượng: ${allTotals.quantity}`;
  document.getElementById('cartBarTotal').textContent=totalLabel(rows);
  document.getElementById('cartBarNote').textContent=allTotals.unknown?`${allTotals.unknown} sản phẩm cần báo giá`:'Đã thêm vào giỏ hàng';
  document.getElementById('cartSubtitle').textContent=`${rows.length} loại sản phẩm trong giỏ hàng`;
  document.getElementById('cartLineCount').textContent=`(${rows.length})`;
  const selectAll=document.getElementById('selectAll');
  selectAll.checked=rows.length>0 && selected.length===rows.length;
  selectAll.indeterminate=selected.length>0 && selected.length<rows.length;
  selectAll.disabled=!rows.length;
  const groups=new Map();
  rows.forEach(row=>{
    const brand=row.product.brand || 'Sản phẩm khác';
    if(!groups.has(brand)) groups.set(brand,[]);
    groups.get(brand).push(row);
  });
  if(refreshItems) document.getElementById('cartItems').innerHTML=rows.length?[...groups].map(([brand,items])=>`
    <section class="cart-group"><h3>${esc(brand)}</h3>${items.map(row=>`
      <article class="cart-item" data-row-key="${esc(row.key)}">
        <input class="item-check" type="checkbox" data-cart-action="select" data-key="${esc(row.key)}" aria-label="Chọn ${esc(row.product.name)}" ${row.selected?'checked':''}>
        <div class="cart-image">${productImage(row.product)}</div>
        <div class="cart-item-info"><h4>${esc(row.product.name)}</h4><p>${esc(row.product.spec||'Quy cách đang cập nhật')}</p>
          <div class="cart-item-price">${esc(row.product.price)}</div>
          <div class="cart-item-bottom">${quantityControl(row.product)}<button class="remove-item" type="button" data-cart-action="remove" data-key="${esc(row.key)}" aria-label="Xoá ${esc(row.product.name)} khỏi giỏ hàng">Xoá</button></div>
          <small class="line-total">Thành tiền: <b>${unitPrice(row.product)===null?'Liên hệ':money(unitPrice(row.product)*row.quantity)}</b></small>
        </div>
      </article>`).join('')}</section>`).join('')
    : '<div class="cart-empty"><span aria-hidden="true">＋</span><h3>Giỏ hàng đang trống</h3><p>Chọn sản phẩm bằng nút + để thêm vào giỏ hàng.</p></div>';
  document.getElementById('selectedLines').textContent=selected.length;
  document.getElementById('selectedQuantity').textContent=summary.quantity;
  document.getElementById('selectedTotal').textContent=totalLabel(selected);
  document.getElementById('cartPriceNote').textContent=summary.unknown
    ? `Có ${summary.unknown} sản phẩm cần báo giá. Tạm tính chỉ cộng các sản phẩm có giá; liên hệ để xác nhận tổng tiền.`
    : 'Giá được xác nhận khi liên hệ.';
  ['deleteCart','checkoutCart','copyOrder'].forEach(id=>document.getElementById(id).disabled=!selected.length);
  document.getElementById('orderMessage').value=orderText(selected);
  document.getElementById('cartFeedback').textContent='';
  syncQuantityControls();
  document.querySelectorAll('[data-row-key]').forEach(element=>{
    const row=rows.find(item=>item.key===element.dataset.rowKey);
    if(!row) return;
    element.querySelector('.item-check').checked=row.selected;
    const price=unitPrice(row.product);
    element.querySelector('.line-total b').textContent=price===null?'Liên hệ':money(price*row.quantity);
  });
  if(focus){
    const replacement=[...document.querySelectorAll('#cartItems [data-cart-action]')].find(el=>el.dataset.key===focus.key && el.dataset.cartAction===focus.action);
    (replacement && !replacement.disabled ? replacement : document.getElementById('continueShopping')).focus({preventScroll:true});
  }
  refreshOrderForm();
}
function refreshOrderForm(){
  const enabled=Boolean(CONFIG.ORDER_API_URL);
  document.getElementById('directOrderForm').hidden=!enabled;
  document.querySelector('.cart-summary').classList.toggle('has-direct-order',enabled);
  document.getElementById('sendOrder').disabled=orderSending || orderSubmitted || !cartRows(true).length;
  document.getElementById('sendOrder').textContent=orderSending?'Đang gửi yêu cầu…':orderSubmitted?'Đã gửi yêu cầu':'Gửi yêu cầu đặt hàng';
  document.querySelector('.cart-products').inert=orderSending;
  document.getElementById('customerName').disabled=orderSending;
  document.getElementById('customerPhone').disabled=orderSending;
  if(orderSending){
    document.getElementById('deleteCart').disabled=true;
    document.getElementById('checkoutCart').disabled=true;
  }
  if(enabled) document.getElementById('checkoutCart').textContent='Liên hệ Zalo';
}
function resetOrderFeedback(){
  if(orderSending) return;
  orderSubmitted=false;
  document.getElementById('orderFeedback').textContent='';
  refreshOrderForm();
}
async function orderAttempt(payload){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
  const fingerprint=[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
  let saved=memoryOrderAttempt;
  try{saved=JSON.parse(sessionStorage.getItem('antin-order-attempt-v1'))||saved;}catch{ /* In-memory retry protection remains available. */ }
  if(saved?.fingerprint!==fingerprint || !/^[a-f0-9-]{36}$/i.test(saved?.requestId||'')) saved={fingerprint,requestId:crypto.randomUUID()};
  memoryOrderAttempt=saved;
  try{sessionStorage.setItem('antin-order-attempt-v1',JSON.stringify(saved));}catch{ /* Do not store customer data in the browser. */ }
  return saved.requestId;
}
async function sendDirectOrder(event){
  event.preventDefault();
  if(orderSending || orderSubmitted || !CONFIG.ORDER_API_URL) return;
  const rows=cartRows(true),feedback=document.getElementById('orderFeedback');
  if(!rows.length) return;
  const customer={name:document.getElementById('customerName').value.trim(),phone:document.getElementById('customerPhone').value.replace(/[\s().-]/g,'')};
  feedback.dataset.error='true';
  if(customer.name.length<2 || !/^(?:0|\+84)[0-9]{9}$/.test(customer.phone)){
    feedback.textContent='Vui lòng nhập tên và số điện thoại Việt Nam hợp lệ.';return;
  }
  if(rows.some(row=>!row.product.productId)){
    feedback.textContent='Một sản phẩm cần được kiểm tra mã. Vui lòng chọn Liên hệ Zalo để được hỗ trợ.';return;
  }
  const payload={customer,items:rows.map(row=>({productId:String(row.product.productId),quantity:row.quantity})).sort((a,b)=>a.productId.localeCompare(b.productId))};
  orderSending=true;refreshOrderForm();feedback.dataset.error='false';feedback.textContent='Đang gửi danh sách đến An Tín Pharma…';
  let requestId='';
  try{
    requestId=await orderAttempt(payload);
    const response=await fetch(CONFIG.ORDER_API_URL,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,...payload}),signal:AbortSignal.timeout(30000),credentials:'omit',redirect:'error'
    });
    const result=await response.json();
    if(!response.ok || result.ok!==true || result.requestId!==requestId){
      feedback.dataset.error='true';
      feedback.textContent=(typeof result.error==='string'?result.error:'Chưa xác nhận gửi thành công. Vui lòng liên hệ Zalo để kiểm tra.')+(result.uncertain?` Mã yêu cầu: ${requestId}`:'');
      return;
    }
    orderSubmitted=true;
    feedback.textContent=`Đã gửi yêu cầu đến An Tín Pharma. Mã: ${requestId}. Chúng tôi sẽ liên hệ số ${customer.phone} để xác nhận. Bạn không cần sao chép hoặc gửi lại qua Zalo.`;
  }catch{
    feedback.dataset.error='true';
    feedback.textContent=`Chưa xác nhận được kết quả gửi. Bạn có thể thử lại cùng nội dung hoặc liên hệ Zalo để kiểm tra.${requestId?` Mã yêu cầu: ${requestId}`:''}`;
  }finally{
    orderSending=false;refreshOrderForm();
    ['deleteCart','checkoutCart'].forEach(id=>document.getElementById(id).disabled=!cartRows(true).length);
  }
}
function openCart(){
  renderCart();
  document.getElementById('cartDialog').showModal();
  document.body.classList.add('cart-open');
}
function closeCart(){
  document.getElementById('cartDialog').close();
}
async function copyOrder(){
  const text=orderText(cartRows(true));
  if(!text) return false;
  let copied=false;
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      copied=true;
    }
  }catch{ /* Keep a selectable preview when clipboard access is unavailable. */ }
  if(!copied){
    document.getElementById('orderPreview').open=true;
    const field=document.getElementById('orderMessage');
    field.focus(); field.select();
    try{ copied=document.execCommand('copy'); }catch{ /* Manual copy remains available. */ }
  }
  document.getElementById('cartFeedback').textContent=copied
    ? 'Đã sao chép danh sách. Hãy dán vào Zalo và gửi cho An Tín Pharma.'
    : 'Chưa sao chép được tự động. Hãy sao chép nội dung trong ô phía trên rồi dán vào Zalo.';
  return copied;
}
function renderProducts(){
  const q=document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered=products.filter(p=>{
    if(!p.visible) return false;
    const inCat=activeCategory==='Tất cả'||p.category===activeCategory;
    const hay=stripAccents([p.name,p.brand,p.productId,p.active,p.spec,p.indication,p.category].join(' ')).toLowerCase();
    const needle=stripAccents(q).toLowerCase();
    return inCat&&(!needle||hay.includes(needle));
  });
  document.getElementById('count').textContent=`${filtered.length} sản phẩm`;
  const grid=document.getElementById('productGrid');
  if(!filtered.length){grid.innerHTML='<div class="empty">Không tìm thấy sản phẩm phù hợp.</div>';return}
  grid.innerHTML=filtered.map(p=>`<article class="card ${cart.has(productKey(p))?'in-cart':''}">
    <div class="product-img">
      ${productImage(p)}
    </div>
    <div class="card-body">
      <h3>${esc(p.name)}</h3>
      ${p.brand?`<div class="meta"><b>Hãng:</b> ${esc(p.brand)}</div>`:''}
      <div class="meta"><b>Quy cách:</b> ${esc(p.spec||'Đang cập nhật')}</div>
      <div class="price">${esc(p.price)}</div>
      <div class="meta"><b>Hoạt chất:</b> ${esc(p.active||'Đang cập nhật')}</div>
      <div class="indication"><b>Chỉ định:</b> ${esc(p.indication||'Đang cập nhật')}</div>
      <div class="product-quantity"><span>Số lượng</span>${quantityControl(p)}</div>
      <div class="actions">
        <button class="btn zalo" data-contact="Zalo" data-key="${esc(productKey(p))}">Zalo</button>
        <button class="btn fb" data-contact="Facebook" data-key="${esc(productKey(p))}">Facebook</button>
      </div>
    </div>
  </article>`).join('');
}
function contact(name,channel){
  if(channel==='Zalo' && CONFIG.ZALO_PHONE){
    window.open(`https://zalo.me/${CONFIG.ZALO_PHONE}`,'_blank');
    return;
  }
  if(channel==='Facebook' && CONFIG.FACEBOOK_URL){
    window.open(CONFIG.FACEBOOK_URL,'_blank');
    return;
  }
  alert(`Kênh ${channel} chưa được cấu hình. Sản phẩm đang hỏi: “${name}”.`);
}
function normMatch(s=''){
  return stripAccents(String(s)).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function buildPriceIndex(rows){
  const regionWanted = normMatch(CONFIG.PRICE_REGION || 'MIENNAM').replace(/\s+/g,'');
  const multiplier = Number(CONFIG.PRICE_MULTIPLIER || 1000);
  const byId = new Map();
  const list = [];

  rows.forEach(r=>{
    const region = pick(r,'sales region','sales_region','sales_region_code','Sales Region');
    const regionNorm = normMatch(region).replace(/\s+/g,'');
    if(regionNorm !== regionWanted) return;

    const productId = pick(r,'Product ID','product_id','product id');
    const productName = pick(r,'product_name','Product Name','Tên sản phẩm','ten_san_pham');
    const brand = pick(r,'brand','Brand','Hãng','hang');
    const rawPrice = pick(r,'retail_price_value','Retail Price Value','retail price value');
    const num = Number(String(rawPrice).replace(',','.').replace(/[^0-9.\-]/g,''));
    if(!Number.isFinite(num)) return;

    const price = Math.round(num * multiplier);
    const item = {
      productId: String(productId||'').trim(),
      nameNorm: normMatch(productName),
      brandNorm: normMatch(brand),
      price
    };
    if(item.productId) byId.set(item.productId,item);
    list.push(item);
  });

  return {byId,list};
}

function applyPriceIndex(index){
  products = products.map(p=>{
    let hit = null;

    if(p.productId && index.byId.has(String(p.productId).trim())){
      hit = index.byId.get(String(p.productId).trim());
    }

    if(!hit){
      const pn = normMatch(p.name);
      const pb = normMatch(p.brand);
      hit = index.list.find(x=>{
        if(!x.nameNorm || !pn) return false;
        const sameName = x.nameNorm === pn || x.nameNorm.includes(pn) || pn.includes(x.nameNorm);
        const sameBrand = !pb || !x.brandNorm || pb === x.brandNorm || pb.includes(x.brandNorm) || x.brandNorm.includes(pb);
        return sameName && sameBrand;
      }) || null;
    }

    return hit ? {...p, price: hit.price.toLocaleString('vi-VN')+'đ'} : p;
  });
}

async function loadPrices(){
  const url = sheetCsvUrl(CONFIG.PRICE_SHEET_URL, CONFIG.PRICE_SHEET_NAME || 'check');
  if(!url) return;
  try{
    const res = await fetch(url,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const rows = parseCSV(await res.text());
    applyPriceIndex(buildPriceIndex(rows));
  }catch(err){
    console.error('Không đọc được nguồn giá:',err);
  }
}

async function loadProducts(){
  if(Array.isArray(window.ANTIN_PRODUCTS) && window.ANTIN_PRODUCTS.length){
    products=window.ANTIN_PRODUCTS.map(p=>({...p}));
    rebuildCategories(); renderCategories(); renderProducts();
    return;
  }

  const url=sheetCsvUrl(CONFIG.GOOGLE_SHEET_URL,CONFIG.SHEET_NAME);
  if(!url){
    products=[...FALLBACK_PRODUCTS];
    rebuildCategories(); renderCategories(); renderProducts();
    return;
  }
  try{
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const rows=parseCSV(await res.text());
    const mapped=rows.map(rowToProduct).filter(p=>p.name);
    if(!mapped.length) throw new Error('Sheet không có dòng sản phẩm hợp lệ');
    products=mapped;
  }catch(err){
    console.error('Không đọc được Google Sheet:',err);
    products=[...FALLBACK_PRODUCTS];
  }
  await loadPrices();
  rebuildCategories(); renderCategories(); renderProducts();
}
document.getElementById('searchInput').addEventListener('input',renderProducts);
document.getElementById('searchButton').addEventListener('click',renderProducts);
document.getElementById('year').textContent=new Date().getFullYear();
document.addEventListener('error',event=>{
  if(event.target.matches?.('.product-img img, .cart-image img')){
    const placeholder=document.createElement('span');
    placeholder.className='image-placeholder';
    placeholder.textContent='Ảnh đang cập nhật';
    event.target.replaceWith(placeholder);
  }
},true);
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button) return;
  const key=button.dataset.key, action=button.dataset.cartAction;
  if(action==='increase') setQuantity(key,(cart.get(key)?.quantity||0)+1);
  if(action==='decrease') setQuantity(key,(cart.get(key)?.quantity||0)-1);
  if(action==='remove') setQuantity(key,0);
  if(button.dataset.contact) contact(findProduct(key)?.name||'',button.dataset.contact);
});
document.addEventListener('change',event=>{
  const {key,cartAction}=event.target.dataset;
  if(cartAction==='quantity'){
    const value=event.target.value.trim();
    setQuantity(key,value===''?NaN:Number(value));
  }
  if(cartAction==='select' && cart.has(key)){
    if(orderSending) return;
    cart.get(key).selected=event.target.checked;
    resetOrderFeedback();
    saveCart(); renderCart(false);
  }
});
document.getElementById('cartToggle').addEventListener('click',openCart);
document.getElementById('viewCart').addEventListener('click',openCart);
document.getElementById('closeCart').addEventListener('click',closeCart);
document.getElementById('continueShopping').addEventListener('click',closeCart);
document.getElementById('cartDialog').addEventListener('close',()=>document.body.classList.remove('cart-open'));
document.getElementById('selectAll').addEventListener('change',event=>{
  if(orderSending) return;
  cart.forEach(item=>item.selected=event.target.checked);
  resetOrderFeedback();
  saveCart(); renderCart(false);
});
document.getElementById('deleteCart').addEventListener('click',()=>{
  if(orderSending) return;
  cartRows(true).forEach(row=>cart.delete(row.key));
  resetOrderFeedback();
  saveCart(); renderCart();
  document.getElementById('cartFeedback').textContent='Đã xoá các sản phẩm được chọn khỏi giỏ hàng.';
});
document.getElementById('copyOrder').addEventListener('click',copyOrder);
document.getElementById('directOrderForm').addEventListener('submit',sendDirectOrder);
document.getElementById('customerName').addEventListener('input',resetOrderFeedback);
document.getElementById('customerPhone').addEventListener('input',resetOrderFeedback);
document.getElementById('checkoutCart').addEventListener('click',()=>{
  if(!cartRows(true).length) return;
  if(!CONFIG.ZALO_PHONE){
    document.getElementById('cartFeedback').textContent='Kênh Zalo chưa được cấu hình.';
    return;
  }
  // Open during the click gesture so browsers do not block the new tab after an await.
  void copyOrder();
  window.open(`https://zalo.me/${CONFIG.ZALO_PHONE}`,'_blank','noopener,noreferrer');
});
loadProducts().then(()=>{
  cart=restoreCart();
  renderProducts(); renderCart();
});
