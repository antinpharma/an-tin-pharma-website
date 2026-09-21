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
function renderProducts(){
  const q=document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered=products.filter(p=>{
    if(!p.visible) return false;
    const inCat=activeCategory==='Tất cả'||p.category===activeCategory;
    const hay=stripAccents([p.name,p.active,p.spec,p.indication,p.category].join(' ')).toLowerCase();
    const needle=stripAccents(q).toLowerCase();
    return inCat&&(!needle||hay.includes(needle));
  });
  document.getElementById('count').textContent=`${filtered.length} sản phẩm`;
  const grid=document.getElementById('productGrid');
  if(!filtered.length){grid.innerHTML='<div class="empty">Không tìm thấy sản phẩm phù hợp.</div>';return}
  grid.innerHTML=filtered.map(p=>`<article class="card">
    <div class="product-img">
      ${p.image
        ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" style="max-width:100%;max-height:100%;object-fit:contain" onerror="this.outerHTML='<div class=&quot;fake-box&quot;>${esc(p.name)}<br><small>Ảnh sản phẩm</small></div>'">`
        : `<div class="fake-box">${esc(p.name)}<br><small>Ảnh sản phẩm</small></div>`}
    </div>
    <div class="card-body">
      <h3>${esc(p.name)}</h3>
      <div class="meta"><b>Quy cách:</b> ${esc(p.spec||'Đang cập nhật')}</div>
      <div class="price">${esc(p.price)}</div>
      <div class="meta"><b>Hoạt chất:</b> ${esc(p.active||'Đang cập nhật')}</div>
      <div class="indication"><b>Chỉ định:</b> ${esc(p.indication||'Đang cập nhật')}</div>
      <div class="actions">
        <button class="btn zalo" onclick='contact(${JSON.stringify(p.name)},"Zalo")'>Zalo</button>
        <button class="btn fb" onclick='contact(${JSON.stringify(p.name)},"Facebook")'>Facebook</button>
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
loadProducts();