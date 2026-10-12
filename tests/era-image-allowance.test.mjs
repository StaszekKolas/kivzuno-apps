import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const backend=readFileSync("netlify/functions/era-image-task.mjs","utf8");
const browser=readFileSync("hub/era-motion/studio-simple.js","utf8");

test("daily allowance check does not claim quota or run a paid provider call",()=>{
  const start=backend.indexOf('if(action==="eligibility")');
  const end=backend.indexOf('if(!["start","status"].includes(action))',start);
  assert.ok(start>=0 && end>start);
  const block=backend.slice(start,end);
  assert.match(block,/await allowance\(request\)/);
  assert.doesNotMatch(block,/runway\(|capacity\(|setJSON\(|action==="start"/);
  const allowance=backend.slice(backend.indexOf("async function allowance(req)"),backend.indexOf("export default"));
  assert.match(allowance,/q\.get\(/);
  assert.doesNotMatch(allowance,/\.setJSON\(/);
  assert.match(allowance,/one_image_per_day/);
  assert.match(allowance,/daily_free_image_limit/);
  assert.match(allowance,/remainingShared:remaining/);
  assert.match(backend,/nextResetAt\(\)/);
  assert.match(backend,/KIVZUNO_SERVER_IMAGE_ENABLED==="owner-approved"/);
  assert.match(backend,/onlyIfNew:true/);
});
test("browser tells users the next daily reset and does not pass through raw quota errors",()=>{
  assert.match(browser,/action:"eligibility"/);
  assert.match(browser,/quotaEligible=false/);
  assert.match(browser,/aiEnabled && !quotaEligible/);
  assert.match(browser,/aiEnabled&&!quotaEligible/);
  assert.match(browser,/one_image_per_day/);
  assert.match(browser,/daily_free_image_limit/);
  assert.match(browser,/Europe\/London/);
  assert.match(browser,/Try again from/);
  assert.match(browser,/lockQuota\(err\.code,err\.resetAt\)/);
  assert.match(browser,/The Generate button is paused|AI limit reached/);
  assert.match(browser,/quotaNotice=note/);
  assert.match(browser,/if\(aiEnabled&&!quotaEligible\)\{/);
  assert.match(browser,/message\(quotaNotice\|\|/);
});
test("browser shows quota used before any expensive photo request",async()=>{
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{
      id,disabled:false,checked:false,textContent:"",dataset:{},
      addEventListener(){},removeAttribute(){},focus(){}
    });
    return elements.get(id);
  };
  const calls=[];
  const fetch=async (_url,opts)=>{
    const action=JSON.parse(opts.body).action;
    calls.push(action);
    if(action==="capabilities")return {ok:true,json:async()=>({available:true})};
    if(action==="eligibility")return {ok:true,json:async()=>({eligible:false,reason:"one_image_per_day",resetAt:"2026-10-13T00:00:00.000Z"})};
    throw Error("Billable call was attempted");
  };
  new Script(browser).runInNewContext({
    document:{getElementById:element},fetch,
    Intl,Date,console,
    URL:{createObjectURL:()=>"",revokeObjectURL(){}}
  });
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual(calls,["capabilities","eligibility"]);
  assert.equal(element("go").disabled,true);
  assert.match(element("mode-banner").textContent,/13 Oct, 01:00 UK time/);
  assert.match(element("go").textContent,/AI limit reached/);
});
