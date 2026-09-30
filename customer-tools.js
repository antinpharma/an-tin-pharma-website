/* Private order history is fetched per account, never saved in browser storage. */
(()=>{
  const $=id=>document.getElementById(id),base=new URL(window.ANTIN_CONFIG.ORDER_API_URL).origin;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>value===null?'Liên hệ':Number(value).toLocaleString('vi-VN')+'đ';
  let historyEpoch=0,feedbackEpoch=0,cursor=null,loading=false,feedbackBusy=false,feedbackSent=false,attempt=null;
  function open(id){
    // Close any open filter so its backdrop does not remain after the dialog.
    document.querySelector('.filter-toggle[aria-expanded="true"]')?.click();
    if(!$(id).open)$(id).showModal();
    document.body.classList.add('service-open');
  }
  for(const id of ['orderHistoryDialog','feedbackDialog'])$(id).addEventListener('close',()=>{
    if(!$('orderHistoryDialog').open&&!$('feedbackDialog').open)document.body.classList.remove('service-open');
    if(id==='orderHistoryDialog'){historyEpoch++;loading=false;$('orderHistoryList').replaceChildren();}
  });
  document.querySelectorAll('[data-close-service]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.closeService).close()));
  async function request(path,body,timeoutMs=20000){
    const auth=window.AntinAccount.headers(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...auth},
        credentials:'omit',redirect:'error',body:JSON.stringify(body),signal:controller.signal});
      const result=await response.json();
      if(!response.ok||result.ok!==true){
        if(response.status===401&&window.AntinAccount.headers().Authorization===auth.Authorization)window.AntinAccount.expire();
        const error=new Error(result.error||'Chưa thực hiện được yêu cầu.');error.uncertain=result.uncertain;error.status=response.status;throw error;
      }
      return result;
    }finally{clearTimeout(timer);}
  }
  function historyCard(order){
    const items=Array.isArray(order.items)?order.items:[],total=items.reduce((sum,item)=>sum+(item.price===null?0:item.price*item.quantity),0);
    const unknown=items.filter(item=>item.price===null).length;
    const status=order.status==='sent'?'Đã gửi yêu cầu':order.status==='sending'?'Đang xử lý / chờ xác nhận gửi':'Chưa xác nhận gửi đủ — liên hệ An Tín';
    const date=new Date(order.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
    const card=document.createElement('article');card.className='history-card';
    card.innerHTML=`<div class="history-card-heading"><strong>${esc(date)}</strong><span class="history-state" data-state="${order.status==='sent'?'sent':'pending'}">${esc(status)}</span></div>
      <p class="history-id">Mã: ${esc(order.requestId)}</p>
      <p>${items.length} loại sản phẩm · Tạm tính: <strong>${unknown===items.length?'Liên hệ':money(total)}</strong>${unknown?' · '+unknown+' sản phẩm cần báo giá':''}</p>
      <details><summary>Xem sản phẩm đã gửi</summary><ul>${items.map(item=>`<li><strong>${esc(item.name)}</strong><small>Mã ${esc(item.productId)} · SL: ${esc(item.quantity)} · Đơn giá lúc gửi: ${esc(money(item.price))}</small></li>`).join('')}</ul></details>`;
    return card;
  }
  async function loadHistory(reset=true){
    if(!reset&&loading)return;
    const epoch=++historyEpoch;
    if(reset){cursor=null;$('orderHistoryList').replaceChildren();}
    loading=true;$('historyStatus').textContent='Đang tải lịch sử…';$('historyMore').hidden=true;$('historyRefresh').disabled=true;
    await window.AntinAccount.ready;
    if(epoch!==historyEpoch)return;
    const account=window.AntinAccount.profile;
    $('historyLogin').hidden=!!account;$('historyRefresh').hidden=!account;
    if(!account){loading=false;$('historyStatus').textContent='Đăng nhập tài khoản đã dùng để gửi đơn.';return;}
    try{
      const data=await request('/orders/history',cursor?{cursor}:{});
      if(epoch!==historyEpoch||window.AntinAccount.profile?.id!==account.id)return;
      if(!Array.isArray(data.orders))throw Error();
      $('orderHistoryList').append(...data.orders.map(historyCard));cursor=data.nextCursor||null;
      $('historyStatus').textContent=$('orderHistoryList').children.length?'Giá hiển thị là giá tại thời điểm gửi yêu cầu.':'Chưa có đơn được ghi nhận trong lịch sử.';
    }catch(error){if(epoch===historyEpoch)$('historyStatus').textContent=error.status?error.message:'Chưa tải được lịch sử. Bạn hãy bấm Làm mới để thử lại.';}
    finally{if(epoch===historyEpoch){loading=false;$('historyRefresh').disabled=false;$('historyMore').hidden=!cursor;}}
  }
  $('orderHistoryToggle').addEventListener('click',()=>{open('orderHistoryDialog');loadHistory();});
  $('historyLogin').addEventListener('click',()=>window.AntinAccount.open('login'));
  $('historyRefresh').addEventListener('click',()=>loadHistory());$('historyMore').addEventListener('click',()=>loadHistory(false));
  function fillContact(){
    const p=window.AntinAccount.profile;
    $('feedbackName').value=p?.name||'';$('feedbackPhone').value=p?.phone||'';
    $('feedbackName').readOnly=!!p;$('feedbackPhone').readOnly=!!p;
  }
  function feedbackControls(){
    $('feedbackForm').querySelectorAll('input,textarea,select').forEach(el=>el.disabled=feedbackBusy||feedbackSent);
    $('sendFeedback').disabled=feedbackBusy||feedbackSent;
    $('sendFeedback').textContent=feedbackBusy?'Đang gửi…':feedbackSent?'Đã gửi góp ý':'Gửi đến AnTinpharma Bot';
    $('newFeedback').hidden=!feedbackSent;
  }
  $('feedbackToggle').addEventListener('click',async()=>{await window.AntinAccount.ready;if(!feedbackBusy&&!feedbackSent)fillContact();open('feedbackDialog');});
  $('newFeedback').addEventListener('click',()=>{feedbackSent=false;attempt=null;$('feedbackForm').reset();fillContact();feedbackControls();$('feedbackStatus').textContent='';$('feedbackMessage').focus();});
  $('feedbackForm').addEventListener('submit',async event=>{
    event.preventDefault();if(feedbackBusy||feedbackSent)return;
    const content={kind:$('feedbackKind').value,message:$('feedbackMessage').value.trim(),customer:{name:$('feedbackName').value.trim(),phone:$('feedbackPhone').value.trim()}};
    if(content.message.length<10){$('feedbackStatus').textContent='Vui lòng nhập ít nhất 10 ký tự.';return;}
    const identity=window.AntinAccount.profile?.id||'',fingerprint=JSON.stringify([identity,content]);
    if(attempt?.fingerprint!==fingerprint)attempt={fingerprint,id:crypto.randomUUID()};
    const requestId=attempt.id;
    const epoch=feedbackEpoch;
    feedbackBusy=true;feedbackControls();$('feedbackStatus').textContent='Đang gửi đến AnTinpharma Bot…';$('feedbackStatus').dataset.error='false';
    try{
      const result=await request('/feedback',{...content,requestId});
      if(epoch!==feedbackEpoch)return;
      if(result.requestId!==requestId)throw Error();
      feedbackSent=true;$('feedbackStatus').textContent='Đã gửi đến AnTinpharma Bot. Cảm ơn bạn! Mã góp ý: '+requestId;
    }catch(error){
      if(epoch!==feedbackEpoch)return;
      $('feedbackStatus').dataset.error='true';
      $('feedbackStatus').textContent=(error.status?error.message:'Chưa xác nhận được kết quả gửi. Bạn có thể thử lại cùng nội dung hoặc liên hệ Zalo.')+' Mã góp ý: '+requestId;
    }finally{feedbackBusy=false;feedbackControls();}
  });
  window.addEventListener('antin-account-changed',()=>{
    historyEpoch++;loading=false;cursor=null;$('orderHistoryList').replaceChildren();
    if($('orderHistoryDialog').open)loadHistory();
    feedbackEpoch++;attempt=null;feedbackSent=false;$('feedbackForm').reset();fillContact();feedbackControls();$('feedbackStatus').textContent='';
  });
})();
