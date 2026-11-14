import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {COOKIE_NAME,newBrowserCookie,getBrowserId,dailyBrowserKey,nextResetAt} from "../netlify/functions/era-image-quota-identity.mjs";

const secret="test-only-unpublished-quota-secret";
const backend=readFileSync("netlify/functions/era-image-task.mjs","utf8");
const browser=readFileSync("hub/era-motion/studio-simple.js","utf8");
const value=cookie=>cookie.split(";")[0];

test("two browsers on one Wi-Fi have separate daily quotas",()=>{
 const a=value(newBrowserCookie(secret)),b=value(newBrowserCookie(secret));
 const aid=getBrowserId(a,secret),bid=getBrowserId(b,secret);
 assert.ok(a.startsWith(COOKIE_NAME+"="));
 assert.ok(aid&&bid&&aid!==bid);
 assert.notEqual(dailyBrowserKey(aid,"2026-10-14",secret),dailyBrowserKey(bid,"2026-10-14",secret));
 assert.equal(dailyBrowserKey(aid,"2026-10-14",secret),dailyBrowserKey(aid,"2026-10-14",secret));
 assert.notEqual(dailyBrowserKey(aid,"2026-10-14",secret),dailyBrowserKey(aid,"2026-10-15",secret));
 assert.match(newBrowserCookie(secret),/Secure; HttpOnly; SameSite=Lax/);
});
test("signed browser ID resists tampering",()=>{
 const a=value(newBrowserCookie(secret));
 assert.equal(getBrowserId(a,secret)?.length,32);
 assert.equal(getBrowserId(a,"wrong-key"),null);
 assert.equal(getBrowserId(a.replace(/^([^=]+=)[a-f0-9]/,"$1z"),secret),null);
 assert.equal(getBrowserId("other=abc",secret),null);
});
test("unchanged 3 shared daily jobs, atomic safety, and no IP-based identity",()=>{
 assert.match(backend,/const MAX_DAY=3/);
 assert.match(backend,/KIVZUNO_IMAGE_MAX_DAILY==="3"/);
 assert.match(backend,/KIVZUNO_SERVER_IMAGE_ENABLED==="owner-approved"/);
 assert.match(backend,/const once=await q\.setJSON\(key,\{used:true\},\{onlyIfNew:true\}\)/);
 assert.match(backend,/await q\.setJSON\("daily\/"\+day\+"\/slot\/"\+i,\{claimed:true\},\{onlyIfNew:true\}\)/);
 assert.match(backend,/one_image_per_day/);
 assert.match(backend,/daily_free_image_limit/);
 assert.doesNotMatch(backend,/req\.headers\.get\("x-nf-client-connection-ip"\)/);
 assert.match(backend,/windowLimit:30/);
});
test("read-only eligibility cannot start paid provider calls",()=>{
 const start=backend.indexOf('if(action==="eligibility")');
 const end=backend.indexOf('if(!["start","status"].includes(action))',start);
 assert.ok(start>=0&&end>start);
 const block=backend.slice(start,end);
 assert.match(block,/await allowance\(request\)/);
 assert.doesNotMatch(block,/runway\(|capacity\(|setJSON\(/);
 assert.match(backend,/ensureBrowserCookie\(request,reply\(/);
 assert.equal(nextResetAt("2026-10-14"),"2026-10-15T00:00:00.000Z");
});
test("UI warns about shared daily cap without a photo request",async()=>{
 const els=new Map();
 const element=id=>{
  if(!els.has(id))els.set(id,{disabled:false,checked:false,hidden:false,textContent:"",dataset:{},addEventListener(){},removeAttribute(){}});
  return els.get(id);
 };
 const actions=[];
 const fetch=async (_url,opts)=>{
  const action=JSON.parse(opts.body).action;actions.push(action);
  if(action==="capabilities")return {ok:true,json:async()=>({available:true})};
  if(action==="eligibility")return {ok:true,json:async()=>({eligible:false,reason:"daily_free_image_limit",resetAt:"2026-10-15T00:00:00.000Z"})};
  throw Error("unexpected paid generation");
 };
 new Script(browser).runInNewContext({document:{getElementById:element},fetch,Date,Intl,console});
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.deepEqual(actions,["capabilities","eligibility"]);
 assert.equal(element("go").disabled,true);
 assert.match(element("mode-banner").textContent,/All three shared free AI photos/);
});
test("polling reduces shared-IP traffic without retrying paid start",()=>{
 assert.match(browser,/for\(let attempt=0;attempt<30;attempt\+\+\)/);
 assert.match(browser,/setTimeout\(resolve,10000\)/);
 assert.match(browser,/action:"start",photo:img,era:chosen,consent:true/);
 assert.match(browser,/credentials:"same-origin"/);
 assert.doesNotMatch(browser,/localStorage|sessionStorage|Puter/);
});
