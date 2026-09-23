/* Customer profiles stay on the server. The tab stores only a short-lived session token. */
(()=>{
  const key='antin-account-session-v1',dialog=document.getElementById('accountDialog');
  const feedback=document.getElementById('accountFeedback');
  let token='',profile=null,busy=false,locationData=null,locationPromise=null;
  try{token=sessionStorage.getItem(key)||'';}catch{}
  const apiBase=new URL(window.ANTIN_CONFIG.ORDER_API_URL).origin;
  const $=id=>document.getElementById(id);
  const report=(message,error=false)=>{feedback.textContent=message;feedback.dataset.error=String(error);};
  function emit(){
    $('accountLabel').textContent=profile?'Tài khoản':'Đăng nhập';
    $('accountToggle').title=profile?'Tài khoản của '+profile.name:'Đăng nhập hoặc đăng ký';
    window.dispatchEvent(new CustomEvent('antin-account-changed',{detail:profile}));
  }
  function clear(){
    token='';profile=null;try{sessionStorage.removeItem(key);}catch{}
    dialog.querySelectorAll('form').forEach(form=>form.reset());$('accountWelcome').textContent='';
    dialog.querySelectorAll('details').forEach(details=>details.open=false);emit();
  }
  function accept(data){
    if(data.token){token=data.token;try{sessionStorage.setItem(key,token);}catch{}}
    if(data.profile)profile=data.profile;
    emit();
  }
  async function request(action,body={}){
    const response=await fetch(apiBase+'/auth/'+action,{
      method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      body:JSON.stringify(body),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)
    });
    const result=await response.json();
    if(!response.ok||!result.ok){
      if(response.status===401&&!['login','register'].includes(action))clear();
      const error=new Error(result.error||'Chưa thực hiện được yêu cầu. Vui lòng thử lại.');error.status=response.status;throw error;
    }
    return result;
  }
  function addOptions(select,rows,placeholder){
    select.replaceChildren(new Option(placeholder,''),...rows.map(row=>new Option(row.name,row.code)));
  }
  function wards(prefix,code=''){
    const province=locationData?.provinces.find(p=>p.code===$(prefix+'Province').value);
    addOptions($(prefix+'Ward'),province?.wards||[],province?'Chọn xã/phường':'Chọn tỉnh/thành phố trước');
    $(prefix+'Ward').disabled=!province;$(prefix+'Ward').value=code;
  }
  async function locations(){
    if(locationData)return locationData;
    if(!locationPromise)locationPromise=fetch('data/locations.json?v=20260923',{signal:AbortSignal.timeout(15000)})
      .then(async response=>{if(!response.ok)throw new Error();return response.json();})
      .then(data=>{locationData=data;for(const prefix of ['register','profile'])addOptions($(prefix+'Province'),data.provinces,'Chọn tỉnh/thành phố');return data;})
      .catch(()=>{locationPromise=null;throw new Error('Chưa tải được tỉnh/thành phố. Vui lòng đóng và mở lại cửa sổ tài khoản.');});
    return locationPromise;
  }
  async function view(name){
    dialog.scrollTop=0;
    const signed=name==='profile'&&profile;
    $('accountTitle').textContent=signed?'Tài khoản của bạn':name==='register'?'Đăng ký tài khoản':'Đăng nhập';
    $('accountTabs').hidden=Boolean(signed);
    $('loginForm').hidden=name!=='login';$('registerForm').hidden=name!=='register';$('profileView').hidden=!signed;
    document.querySelectorAll('.account-tabs button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.accountView===name)));
    report('');
    if(name==='register'||signed){
      try{
        await locations();
        if(signed&&profile){
          $('accountWelcome').textContent='Xin chào '+profile.name+'. Thông tin này sẽ được dùng khi gửi đơn.';
          $('profileName').value=profile.name;$('profilePhone').value=profile.phone;$('profileAddress').value=profile.address;
          $('profileProvince').value=profile.provinceCode;wards('profile',profile.wardCode);
        }
      }catch(error){report(error.message,true);}
    }
  }
  function open(name){
    view(name||(profile?'profile':'login'));
    if(!dialog.open)dialog.showModal();
  }
  function wipePasswords(){
    dialog.querySelectorAll('input[autocomplete="current-password"],input[autocomplete="new-password"]').forEach(input=>{input.value='';input.type='password';});
    dialog.querySelectorAll('[data-show-password]').forEach(input=>input.checked=false);
  }
  async function run(task){
    if(busy)return;
    busy=true;report('Đang xử lý…');
    const disabled=[...dialog.querySelectorAll('input,select,button')].map(el=>[el,el.disabled]);
    disabled.forEach(([el])=>el.disabled=true);
    try{await task();}catch(error){report(error.status?error.message:'Không kết nối được máy chủ. Vui lòng thử lại.',true);}
    finally{busy=false;disabled.forEach(([el,previous])=>el.disabled=previous);for(const prefix of ['register','profile'])$(prefix+'Ward').disabled=!$(prefix+'Province').value;}
  }
  const values=form=>Object.fromEntries(new FormData(form));
  function checkConfirmation(form){
    const password=form.elements.namedItem('password'),confirm=form.elements.namedItem('confirmPassword');
    if(password&&confirm&&password.value!==confirm.value){confirm.setCustomValidity('Mật khẩu nhập lại chưa trùng khớp.');confirm.reportValidity();return false;}
    return true;
  }
  for(const form of ['registerForm','passwordForm'])for(const name of ['password','confirmPassword'])$(form).elements.namedItem(name).addEventListener('input',()=>$(form).elements.namedItem('confirmPassword').setCustomValidity(''));
  $('loginForm').addEventListener('submit',event=>{
    event.preventDefault();const body=values(event.target);
    run(async()=>{accept(await request('login',body));wipePasswords();dialog.close();});
  });
  $('registerForm').addEventListener('submit',event=>{
    event.preventDefault();if(!checkConfirmation(event.target))return;
    const body=values(event.target);body.consent=event.target.elements.namedItem('consent').checked;
    run(async()=>{accept(await request('register',body));event.target.reset();wards('register');wipePasswords();dialog.close();});
  });
  $('profileForm').addEventListener('submit',event=>{
    event.preventDefault();const body=values(event.target);
    run(async()=>{accept(await request('profile',body));report('Đã lưu thông tin nhận hàng.');});
  });
  $('passwordForm').addEventListener('submit',event=>{
    event.preventDefault();if(!checkConfirmation(event.target))return;const body=values(event.target);
    run(async()=>{accept(await request('password',body));wipePasswords();report('Đã đổi mật khẩu và đăng xuất các phiên đăng nhập khác.');});
  });
  $('deleteAccountForm').addEventListener('submit',event=>{
    event.preventDefault();const body=values(event.target);
    run(async()=>{const removedId=profile?.id;await request('delete',body);clear();try{localStorage.removeItem('antin-cart-account:'+removedId);}catch{}wipePasswords();event.target.reset();await view('login');report('Đã xóa tài khoản.');});
  });
  $('logoutAccount').addEventListener('click',()=>run(async()=>{await request('logout');clear();wipePasswords();dialog.close();}));
  $('accountToggle').addEventListener('click',()=>open());
  $('closeAccount').addEventListener('click',()=>{if(!busy)dialog.close();});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{wipePasswords();dialog.querySelectorAll('details').forEach(details=>details.open=false);});
  document.querySelectorAll('[data-account-view]').forEach(button=>button.addEventListener('click',()=>view(profile?'profile':button.dataset.accountView)));
  for(const prefix of ['register','profile'])$(prefix+'Province').addEventListener('change',()=>wards(prefix));
  document.querySelectorAll('[data-show-password]').forEach(input=>input.addEventListener('change',()=>{
    $(input.dataset.showPassword).querySelectorAll('input[autocomplete="current-password"],input[autocomplete="new-password"]').forEach(field=>field.type=input.checked?'text':'password');
  }));
  document.querySelector('.forgot-password').href='https://zalo.me/'+window.ANTIN_CONFIG.ZALO_PHONE;
  window.AntinAccount={open,get profile(){return profile;},headers:()=>token?{Authorization:'Bearer '+token}:{},expire:clear};
  if(token)request('me').then(accept).catch(()=>{ /* Invalid sessions are cleared by request; transient failures can be retried by signing in. */ });
})();
