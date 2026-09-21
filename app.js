const products=[
{name:'Nexium 40mg',category:'Thuốc',spec:'Hộp 28 viên',price:'Liên hệ',active:'Esomeprazole 40mg',indication:'Thông tin tham khảo. Vui lòng liên hệ An Tín Pharma để được tư vấn thêm.'},
{name:'Xatral XL 10mg',category:'Thuốc',spec:'Hộp 30 viên',price:'Liên hệ',active:'Alfuzosin hydrochloride 10mg',indication:'Thông tin tham khảo. Vui lòng liên hệ An Tín Pharma để được tư vấn thêm.'},
{name:'Lovenox 40mg/0.4ml',category:'Thuốc',spec:'Hộp 2 bơm tiêm',price:'Liên hệ',active:'Enoxaparin sodium',indication:'Thông tin tham khảo. Vui lòng liên hệ An Tín Pharma để được tư vấn thêm.'},
{name:'Dymista',category:'Thuốc',spec:'Chai xịt mũi 120 liều',price:'Liên hệ',active:'Azelastine + Fluticasone',indication:'Thông tin tham khảo. Vui lòng liên hệ An Tín Pharma để được tư vấn thêm.'},
{name:'Vitamin C 1000mg',category:'Thực phẩm bảo vệ sức khỏe',spec:'Hộp 30 viên',price:'Liên hệ',active:'Vitamin C',indication:'Thông tin sản phẩm sẽ được An Tín Pharma cập nhật.'},
{name:'Khẩu trang y tế 4 lớp',category:'Vật tư y tế',spec:'Hộp 50 cái',price:'Liên hệ',active:'—',indication:'Thông tin sản phẩm sẽ được An Tín Pharma cập nhật.'}
];
const categories=['Tất cả','Thuốc','Thực phẩm bảo vệ sức khỏe','Mỹ phẩm','Vật tư y tế'];
let activeCategory='Tất cả';
function renderCategories(){
  document.getElementById('categories').innerHTML=categories.map(c=>`<button class="chip ${c===activeCategory?'active':''}" data-cat="${c}">${c}</button>`).join('');
  document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{activeCategory=b.dataset.cat;renderCategories();renderProducts()}));
}
function renderProducts(){
  const q=document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered=products.filter(p=>{
    const inCat=activeCategory==='Tất cả'||p.category===activeCategory;
    const hay=(p.name+' '+p.active+' '+p.spec+' '+p.indication).toLowerCase();
    return inCat&&(!q||hay.includes(q));
  });
  document.getElementById('count').textContent=`${filtered.length} sản phẩm`;
  const grid=document.getElementById('productGrid');
  if(!filtered.length){grid.innerHTML='<div class="empty">Không tìm thấy sản phẩm phù hợp.</div>';return}
  grid.innerHTML=filtered.map(p=>`<article class="card">
    <div class="product-img"><div class="fake-box">${p.name}<br><small>Ảnh sản phẩm</small></div></div>
    <div class="card-body">
      <h3>${p.name}</h3>
      <div class="meta"><b>Quy cách:</b> ${p.spec}</div>
      <div class="price">${p.price}</div>
      <div class="meta"><b>Hoạt chất:</b> ${p.active}</div>
      <div class="indication"><b>Thông tin:</b> ${p.indication}</div>
      <div class="actions">
        <button class="btn zalo" onclick="contact('${p.name}','Zalo')">Zalo</button>
        <button class="btn fb" onclick="contact('${p.name}','Facebook')">Facebook</button>
      </div>
    </div>
  </article>`).join('');
}
function contact(name,channel){
  alert(`Bản website đã sẵn sàng. Cần gắn link ${channel} thật của An Tín để mở hội thoại về “${name}”.`);
}
document.getElementById('searchInput').addEventListener('input',renderProducts);
document.getElementById('searchButton').addEventListener('click',renderProducts);
document.getElementById('year').textContent=new Date().getFullYear();
renderCategories();
renderProducts();