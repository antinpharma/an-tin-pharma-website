// Read the admin key from a local ignored env file, never from command arguments.
// node --env-file=.env.zalo-admin.local workers/admin.mjs check
// node --env-file=.env.zalo-admin.local workers/admin.mjs pair ANTIN-...
const [command,code]=process.argv.slice(2);
const key=process.env.ZALO_SETUP_KEY;
if(!key || !['check','pair'].includes(command) || (command==='pair' && !/^ANTIN-[A-Z0-9]{12,32}$/.test(code||''))){
  console.error('Cần ZALO_SETUP_KEY và lệnh check hoặc pair ANTIN-<mã xác minh>.');
  process.exitCode=1;
}else{
  try{
    const response=await fetch('https://antin-orders.minhtran123hehe.workers.dev/admin/'+command,{
      method:'POST',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify(command==='pair'?{code}:{}),
      signal:AbortSignal.timeout(command==='pair'?45000:20000),redirect:'error'
    });
    const data=await response.json();
    // Print only the documented safe fields; never raw provider responses or URLs.
    console.log(JSON.stringify({status:response.status,ok:data.ok,botId:data.botId,accountName:data.accountName,paired:data.paired,error:data.error}));
    if(!response.ok)process.exitCode=1;
  }catch{
    console.error('Không kiểm tra được kết nối. Thông tin xác thực không được ghi ra log.');
    process.exitCode=1;
  }
}
