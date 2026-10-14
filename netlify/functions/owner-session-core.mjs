import {createHmac,timingSafeEqual} from "node:crypto";

export const OWNER_COOKIE="kz_owner";
export const OWNER_SESSION_MS=12*60*60*1000;
export function ownerConfigured(env=process.env){
 return env.KIVZUNO_PRIVATE_BETA_ENABLED==="owner-approved" &&
   typeof env.KIVZUNO_OWNER_TEST_SECRET==="string" &&
   env.KIVZUNO_OWNER_TEST_SECRET.length>=32;
}
export function ownerSignature(expiry,secret){
 return createHmac("sha256",secret).update("kivzuno-owner-v1:"+String(expiry)).digest("hex");
}
export function verifyOwnerCookie(cookieHeader,secret,now=Date.now()){
 if(typeof secret!=="string"||secret.length<32||typeof cookieHeader!=="string")return false;
 const values=cookieHeader.split(";").map(x=>x.trim())
   .filter(x=>x.startsWith(OWNER_COOKIE+"=")).map(x=>x.slice(OWNER_COOKIE.length+1));
 if(values.length!==1)return false;
 const m=/^([1-9][0-9]{12})\.([a-f0-9]{64})$/.exec(values[0]);
 if(!m)return false;
 const expiry=Number(m[1]);
 if(!Number.isSafeInteger(expiry)||expiry<now||expiry>now+OWNER_SESSION_MS)return false;
 const expected=ownerSignature(expiry,secret);
 return timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(m[2],"hex"));
}
export function requirePrivateOwner(request,env=process.env){
 if(!ownerConfigured(env))return {ok:false,error:"private_beta_not_configured",status:503};
 if(!verifyOwnerCookie(request.headers.get("cookie"),env.KIVZUNO_OWNER_TEST_SECRET))
   return {ok:false,error:"owner_login_required",status:401};
 return {ok:true};
}
