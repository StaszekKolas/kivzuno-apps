import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";

// Anonymous browser ID, NOT a person or an account. No IP address is stored.
// The server signs it so visitors cannot manufacture additional identities
// without clearing their cookies. The existing global daily quota remains.
export const COOKIE_NAME="__Host-kivzuno-era-id";
export function signBrowserId(id,secret){
  return createHmac("sha256",secret).update("kivzuno-era-browser-v1:"+id).digest("hex");
}
export function getBrowserId(cookieHeader,secret){
  if(typeof cookieHeader!=="string"||!secret)return null;
  const pair=cookieHeader.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE_NAME+"="));
  if(!pair)return null;
  const value=pair.slice(COOKIE_NAME.length+1);
  const match=/^([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value);
  if(!match)return null;
  const expected=signBrowserId(match[1],secret);
  return timingSafeEqual(Buffer.from(match[2],"hex"),Buffer.from(expected,"hex"))?match[1]:null;
}
export function newBrowserCookie(secret){
  if(!secret)throw new Error("quota_secret_unavailable");
  const id=randomBytes(16).toString("hex");
  return COOKIE_NAME+"="+id+"."+signBrowserId(id,secret)
    +"; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=15552000";
}
export function dailyBrowserKey(id,day,secret){
  if(!/^[a-f0-9]{32}$/.test(id)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!secret)throw new Error("invalid_quota_identity");
  const token=createHmac("sha256",secret).update(day+":"+id).digest("hex");
  return "browser/"+day+"/"+token;
}
export const utcDay=()=>new Date().toISOString().slice(0,10);
export function nextResetAt(day=utcDay()){
  return new Date(Date.parse(day+"T00:00:00.000Z")+24*60*60*1000).toISOString();
}
