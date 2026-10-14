// Netlify Edge Function: protect Era Motion AND its billable APIs.
// Fail closed until a unique owner password and private-beta flag are configured.
// Session cookie signature format is shared with the Node function guard.
const LIFE=12*60*60*1000;
const enc=new TextEncoder();
const html=(error=false)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private KIVZUNO Studio</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#f8faff;font:16px system-ui;padding:18px}.card{width:min(100%,440px);padding:32px;background:#17223a;border:1px solid #ffffff35;border-radius:20px}h1{font-size:28px;letter-spacing:-.05em;margin:8px 0}p{color:#ccd6e4;line-height:1.55}input,button{width:100%;font:inherit;border-radius:12px;padding:15px;margin-top:14px}input{background:#0e1628;color:white;border:1px solid #ffffff55}button{background:#bef2ce;color:#18233b;border:0;font-weight:800}.err{color:#ffb7b7}</style></head><body><main class="card"><p style="color:#baf0cc">KIVZUNO · PRIVATE TEST</p><h1>Owner access only</h1><p>This AI photo & video studio is not available to the public yet.</p>${error?'<p class="err">Incorrect access code. Please try again.</p>':""}<form method="POST" action="/era-motion/owner-login"><label for="pw">Your private access code</label><input name="password" id="pw" type="password" required autocomplete="current-password" minlength="32"><button type="submit">Unlock my studio</button></form></main></body></html>`;
const noStore={"cache-control":"no-store","x-robots-tag":"noindex,nofollow","x-content-type-options":"nosniff"};
async function hmac(secret,data){
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=await crypto.subtle.sign("HMAC",key,enc.encode(data));
 return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function valid(cookie,secret){
 const items=(cookie||"").split(";").map(v=>v.trim()).filter(v=>v.startsWith("kz_owner="));
 if(items.length!==1)return false;
 const m=/^kz_owner=([1-9][0-9]{12})\.([a-f0-9]{64})$/.exec(items[0]);
 if(!m)return false;
 const expires=Number(m[1]),now=Date.now();
 if(!Number.isSafeInteger(expires)||expires<now||expires>now+LIFE)return false;
 const expected=await hmac(secret,"kivzuno-owner-v1:"+m[1]);
 if(expected.length!==m[2].length)return false;
 let wrong=0;for(let i=0;i<expected.length;i++)wrong|=expected.charCodeAt(i)^m[2].charCodeAt(i);
 return wrong===0;
}
async function equalPass(a,b){
 // Constant-time comparison of HMAC digests of the submitted and expected passwords.
 const expected=await hmac("kivzuno-login-comparison",b);
 const got=await hmac("kivzuno-login-comparison",a);
 let wrong=0;for(let i=0;i<expected.length;i++)wrong|=expected.charCodeAt(i)^got.charCodeAt(i);
 return wrong===0;
}
export default async function privateEraGate(request,context){
 const enabled=Netlify.env.get("KIVZUNO_PRIVATE_BETA_ENABLED")==="owner-approved";
 const secret=Netlify.env.get("KIVZUNO_OWNER_TEST_SECRET");
 if(!enabled||typeof secret!=="string"||secret.length<32)
   return new Response("Era Motion is closed until the owner configures private access.",{status:503,headers:noStore});
 const pathname=new URL(request.url).pathname;
 const isApi=pathname.startsWith("/.netlify/functions/");
 if(pathname==="/era-motion/owner-login" && request.method==="POST"){
   if(Number(request.headers.get("content-length")||0)>1024)return new Response("Invalid input",{status:400,headers:noStore});
   let pass="";
   try{const body=await request.formData();pass=String(body.get("password")||"");}catch{}
   if(pass.length>512 || !await equalPass(pass,secret))return new Response(html(true),{status:401,headers:{...noStore,"content-type":"text/html; charset=utf-8"}});
   const expires=Date.now()+LIFE;
   const signature=await hmac(secret,"kivzuno-owner-v1:"+expires);
   return new Response(null,{status:303,headers:{...noStore,"location":"/era-motion/","set-cookie":`kz_owner=${expires}.${signature}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict`}});
 }
 if(!await valid(request.headers.get("cookie"),secret)){
   if(isApi)return new Response(JSON.stringify({error:"owner_login_required"}),{status:401,headers:{...noStore,"content-type":"application/json"}});
   return new Response(html(false),{status:401,headers:{...noStore,"content-type":"text/html; charset=utf-8"}});
 }
 return context.next();
}
export const config={path:[
  "/era-motion",
  "/era-motion/*",
  "/.netlify/functions/era-image-task",
  "/.netlify/functions/owner-video-task",
  "/.netlify/functions/runway-handoff"
]};
