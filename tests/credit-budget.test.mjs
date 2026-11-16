import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash, timingSafeEqual} from "node:crypto";
import {Script} from "node:vm";

const source=readFileSync("netlify/functions/era-owner-test.mjs","utf8");
const frontend=readFileSync("hub/era-motion/studio-simple.js","utf8");

function setup({reserved=0,cap=100}={}){
  const reservations=new Map(Array.from({length:reserved},(_,i)=>["credit/"+i,{taskId:"previous-run"}]));
  const jobs=new Map();
  let writes=0,providerCalls=0;
  const getStore=({name})=>{
    const bucket=name.includes("reservations")?reservations:jobs;
    return {
      async list({prefix}={}){return {blobs:[...bucket.keys()].filter(key=>!prefix||key.startsWith(prefix)).map(key=>({key}))};},
      async get(key){return bucket.get(key)||null;},
      async setJSON(key,value,{onlyIfNew}={}){
        if(onlyIfNew&&bucket.has(key))return {modified:false};
        bucket.set(key,value);writes++;
        return {modified:true,etag:'"a"'};
      }
    };
  };
  const js=source.replace(/^import .*?;\s*$/gm,"")
    .replace("export default async function handler","async function handler")
    .replace("export const config=","const config=");
  const make=new Function("getStore","randomUUID","randomBytes","createHash",
    "timingSafeEqual","ERAS","parseImage","reply","promptForEra","MODEL",
    "RATIO","DURATION","process","fetch","AbortSignal","Buffer","URL",js+";return handler");
  const ownerSecret="the-private-test-secret-with-at-least-32-chars";
  const handler=make(
    getStore,()=> "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    ()=>({toString:()=>"f".repeat(64)}),createHash,timingSafeEqual,
    {west:"historical western town"},
    photo=>({dataUri:photo}), (body,status=200)=>({status,body}),
    ()=>"","gen4_turbo","720:1280",5,
    {env:{KIVZUNO_OWNER_TEST_ENABLED:"owner-approved",RUNWAYML_API_SECRET:"fake",
      KIVZUNO_OWNER_TEST_TOKEN:ownerSecret,
      KIVZUNO_OWNER_TEST_BUDGET_CREDITS:String(cap)}},
    async()=>{providerCalls++;throw Error("no paid task expected")},
    {timeout:()=>null},Buffer,URL
  );
  const request=(action,authorized=true)=>({
    method:"POST",url:"https://example.com/.netlify/functions/era-owner-test",
    headers:{get(key){return key==="origin"?"https://example.com":
      key==="authorization"&&authorized?"Bearer "+ownerSecret:null;}},
    async text(){return JSON.stringify({
      action,photo:"test-valid-reference",era:"west",motion:"animals",
      aspect:"landscape",consent:true
    });}
  });
  return {handler,request,read:()=>({reserved:reservations.size,writes,providerCalls})};
}

test("owner-approved 200 EXTRA credits raise preview reservation cap from 100 to 300, without discarding historic reservations",async()=>{
  const ctx=setup({reserved:100});
  const status=await ctx.handler(ctx.request("budget_status"));
  assert.equal(status.status,200);
  assert.equal(status.body.cap,300);
  assert.equal(status.body.originalBudget,100);
  assert.equal(status.body.additionalApproved,200);
  assert.equal(status.body.reserved,100);
  assert.equal(status.body.remaining,200);
  assert.match(status.body.note,/NOT actual provider spending/);
  assert.deepEqual(ctx.read(),{reserved:100,writes:0,providerCalls:0});
});

test("not enough credits for 2-credit scene causes zero new reservations and zero provider calls",async()=>{
  const ctx=setup({reserved:299});
  const result=await ctx.handler(ctx.request("scene_prepare"));
  assert.equal(result.status,429);
  assert.equal(result.body.error,"owner_credit_budget_exhausted");
  assert.deepEqual(ctx.read(),{reserved:299,writes:1,providerCalls:0});
  // One bookkeeping job may be recorded but not sent to Runway.
});

test("the owner ledger is never disclosed without valid authorization",async()=>{
  const ctx=setup({reserved:295});
  const result=await ctx.handler(ctx.request("budget_status",false));
  assert.equal(result.status,403);
  assert.equal(result.body.error,"owner_authorization_required");
  assert.equal(ctx.read().providerCalls,0);
});

test("the iPhone UI disables generation when the reserved budget cannot cover it",()=>{
  assert.doesNotThrow(()=>new Script(frontend));
  assert.match(frontend,/action:"budget_status"/);
  assert.match(frontend,/ownerBudgetRemaining<required/);
  assert.match(frontend,/This is NOT your Runway Dev balance/);
  assert.match(frontend,/No generation was submitted/);
});

test("unexpected settings do not authorize hidden extensions or new provider calls",async()=>{
  const ctx=setup({reserved:100,cap:300});
  const status=await ctx.handler(ctx.request("budget_status"));
  // Both the initial and the supplemental authorization are strictly tied
  // to the verified original Netlify test value of 100.
  assert.equal(status.status,503);
  assert.equal(status.body.error,"owner_beta_not_configured");
  assert.deepEqual(ctx.read(),{reserved:100,writes:0,providerCalls:0});
});
