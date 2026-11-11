import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,timingSafeEqual} from "node:crypto";
const backend=readFileSync("netlify/functions/era-owner-test.mjs","utf8");
const ui=readFileSync("hub/era-motion/studio-simple.js","utf8");
const html=readFileSync("hub/era-motion/index.html","utf8");
const UUID={
  image:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  video:"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  orphan:"cccccccc-cccc-cccc-cccc-cccccccccccc",
  provider:"dddddddd-dddd-dddd-dddd-dddddddddddd"
};
function fixture(){
  const reservation=new Map();
  const rows=[UUID.image,UUID.image,UUID.video,UUID.video,UUID.video,UUID.orphan];
  rows.forEach((taskId,i)=>reservation.set("credit/"+i,{taskId,reservedAt:"2026-10-13T11:00:00.000Z"}));
  const jobs=new Map([
    ["task/"+UUID.image,{kind:"image",state:"SUBMITTED",ownerTask:UUID.provider}],
    ["task/"+UUID.video,{kind:"video",state:"REVIEW_REQUIRED",ownerTask:null}]
  ]);
  let writes=0,providerCalls=0;
  const getStore=({name})=>{
    const store=name.includes("credit-reservations")?reservation:jobs;
    return {
      async list({prefix}){return{blobs:[...store.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))};},
      async get(key){return store.get(key)||null;},
      async setJSON(){writes++;throw Error("audit must not write");}
    };
  };
  const source=backend.replace(/^import .*?;\s*$/gm,"")
    .replace("export default async function handler","async function handler")
    .replace("export const config=","const config=");
  const make=new Function("getStore","randomUUID","randomBytes","createHash","timingSafeEqual",
    "ERAS","parseImage","reply","promptForEra","MODEL","RATIO","DURATION","process",
    "fetch","AbortSignal","Buffer","URL",source+";return handler");
  const secret="test-owner-token-with-at-least-thirty-two-characters";
  const handler=make(getStore,()=>UUID.image,()=>({toString:()=>"f".repeat(64)}),
    createHash,timingSafeEqual,{west:"Wild West"},x=>({dataUri:x}),
    (body,status=200)=>({body,status}),()=>"", "gen4_turbo","720:1280",5,
    {env:{KIVZUNO_OWNER_TEST_ENABLED:"owner-approved",RUNWAYML_API_SECRET:"placeholder",
      KIVZUNO_OWNER_TEST_TOKEN:secret,KIVZUNO_OWNER_TEST_BUDGET_CREDITS:"100"}},
    async()=>{providerCalls++;throw Error("read-only audit must not call provider");},
    {timeout:()=>null},Buffer,URL);
  const request=(authorized=true)=>({
    method:"POST",url:"https://audit.example/.netlify/functions/era-owner-test",
    headers:{get:key=>key==="origin"?"https://audit.example":
      key==="authorization"&&authorized?"Bearer "+secret:null},
    text:async()=>JSON.stringify({action:"audit_reservations"})
  });
  return {handler,request,counts:()=>({writes,providerCalls,reservationSize:reservation.size})};
}
test("owner audit is read-only, summarizes reservations, without claiming provider spend",async()=>{
  const x=fixture();
  const result=await x.handler(x.request());
  assert.equal(result.status,200);
  const d=result.body;
  assert.equal(d.readOnly,true);
  assert.equal(d.actualProviderCreditsCharged,null);
  assert.equal(d.cap,300);
  assert.equal(d.reservedCredits,6);
  assert.equal(d.remainingCredits,294);
  assert.equal(d.jobCount,3);
  assert.deepEqual(d.byKind.image,{jobs:1,credits:2});
  assert.deepEqual(d.byKind.video,{jobs:1,credits:3});
  assert.deepEqual(d.byKind.unknown,{jobs:1,credits:1});
  assert.deepEqual(d.bySavedState.SUBMITTED,{jobs:1,credits:2});
  assert.deepEqual(d.bySavedState.REVIEW_REQUIRED,{jobs:1,credits:3});
  assert.deepEqual(d.bySavedState.missing_job,{jobs:1,credits:1});
  assert.equal(d.withSavedProviderTaskCredits,2);
  assert.equal(d.withoutSavedProviderTaskCredits,4);
  assert.equal(d.partialReservationJobs,1);
  assert.equal(d.partialReservationCredits,3);
  assert.match(d.reconciliationNote,/Do NOT refund, reset or increase/);
  assert.deepEqual(x.counts(),{writes:0,providerCalls:0,reservationSize:6});
});
test("audit is inaccessible without owner token, and not shown until unlocked",async()=>{
  const x=fixture();
  const result=await x.handler(x.request(false));
  assert.equal(result.status,403);
  assert.equal(result.body.error,"owner_authorization_required");
  assert.deepEqual(x.counts(),{writes:0,providerCalls:0,reservationSize:6});
  assert.match(html,/id="credit-audit" class="credit-audit" hidden/);
  assert.match(ui,/if\(!aiEnabled\|\|!ownerKey\)/);
  assert.match(ui,/action:"audit_reservations"/);
  assert.doesNotMatch(ui,/RUNWAYML_API_SECRET|localStorage|sessionStorage/);
});
