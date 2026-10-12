import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const photo=readFileSync("netlify/functions/era-image-task.mjs","utf8");
const video=readFileSync("netlify/functions/era-owner-video.mjs","utf8");
const auth=readFileSync("netlify/functions/era-owner-test-core.mjs","utf8");
const browser=readFileSync("hub/era-motion/studio-simple.js","utf8");
const html=readFileSync("hub/era-motion/index.html","utf8");

test("owner must unlock studio and secret is never embedded in source",()=>{
 assert.match(html,/id="owner-login"/);
 assert.match(html,/id="owner-workspace"[^>]+hidden/);
 assert.match(html,/id="owner-key" type="password"/);
 assert.match(browser,/ownerKey=secret/);
 assert.match(browser,/input\.value=""/);
 assert.match(browser,/x-kivzuno-owner-key/);
 assert.doesNotMatch(browser,/localStorage|sessionStorage|document\.cookie/);
 assert.match(auth,/timingSafeEqual/);
 assert.match(auth,/KIVZUNO_OWNER_TEST_ENABLED==="owner-approved"/);
 assert.match(auth,/process\.env\.KIVZUNO_OWNER_TEST_SECRET\.length>=32/);
 assert.match(auth,/provided\.length<32/);
});
test("any unauthenticated generation request is rejected before provider submission",()=>{
 const p=photo.indexOf('if(!ownerAuthorized(request))return reply({error:"owner_access_required"},403);');
 const claim=photo.indexOf('await claimOwnerTestSlot("image")');
 assert.ok(p>=0 && claim>p);
 const v=video.indexOf('if(!ownerAuthorized(request))return reply({error:"owner_access_required"},403);');
 const started=video.indexOf('if(action==="start")');
 assert.ok(v>=0 && started>v);
 assert.match(photo,/available:enabled\(\) && ownerAuthorized\(request\)/);
 assert.match(video,/videoAvailable:ownerConfigured\(\)&&ownerAuthorized\(request\)/);
});
test("no one-a-day IP quota in private test, but lifetime credits remain capped",()=>{
 assert.match(photo,/await claimOwnerTestSlot\("image"\)/);
 assert.match(video,/await claimOwnerTestSlot\("video"\)/);
 assert.doesNotMatch(photo,/try \{await capacity\(request\)/);
 assert.match(auth,/MAX_TEST_IMAGES=40/);
 assert.match(auth,/MAX_TEST_VIDEOS=4/);
 assert.match(auth,/onlyIfNew:true/);
 assert.match(video,/onlyIfNew:true/);
 assert.match(video,/video_already_requested_for_photo_and_era/);
 assert.match(video,/ownerApproval!==true/);
 assert.match(video,/promptImage:image.dataUri/);
 assert.match(video,/model:MODEL/);
 assert.match(video,/duration:DURATION/);
 assert.match(video,/creditsPerAttempt:25/);
});
test("independent photo and video choices, one original upload and no prerequisite image generation",()=>{
 assert.match(html,/id="video-approval"/);
 assert.match(html,/id="generate-video"/);
 assert.match(html,/id="finished-video"/);
 assert.match(html,/id="video-open"/);
 assert.match(html,/name="product" value="photo" checked/);
 assert.match(html,/name="product" value="video"/);
 assert.match(html,/id="photo-submit"/);
 assert.match(html,/id="video-submit"/);
 assert.match(browser,/action:"start",photo,era:chosenEra,ownerApproval:true/);
 assert.match(browser,/ownerApproval:true/);
 assert.doesNotMatch(video,/LEMON_SQUEEZY|checkout|stripe|receiptValid/);
 assert.doesNotMatch(video,/imageTask|imageJobId|imageAccessToken/);
 assert.match(video,/parseImage\(body\.photo\)/);
 assert.match(video,/const sourceHash=sha\(image.sha256/);
 assert.match(video,/No automatic reattempt/);
});
test("owner login verifies access without using Runway credits",async()=>{
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   id,value:"",disabled:false,checked:false,textContent:"",dataset:{},
   hidden:id==="owner-workspace"||id==="owner-note",
   addEventListener(name,fn){this[name]=fn;},removeAttribute(){},focus(){}
  });
  return elements.get(id);
 };
 const calls=[];
 const fetch=async (url,opts)=>{
  const action=JSON.parse(opts.body).action;
  const key=opts.headers["x-kivzuno-owner-key"];
  calls.push({url,action,key});
  assert.equal(key,"X".repeat(40));
  if(action==="capabilities" && url.includes("era-owner-video"))
   return {ok:true,json:async()=>({videoAvailable:true})};
  if(action==="capabilities")
   return {ok:true,json:async()=>({available:true,ownerTesting:true})};
  if(action==="eligibility")
   return {ok:true,json:async()=>({eligible:true})};
  throw Error("Unexpected billable call");
 };
 new Script(browser).runInNewContext({
  document:{getElementById:element,querySelectorAll:()=>[
    {value:"photo",checked:true,addEventListener(){}},
    {value:"video",checked:false,addEventListener(){}}
  ]},fetch,Intl,Date,console,
  URL:{createObjectURL:()=>"",revokeObjectURL(){}}
 });
 element("owner-key").value="X".repeat(40);
 await element("owner-unlock").click();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.deepEqual(calls.map(x=>x.action),["capabilities","capabilities","capabilities","eligibility"]);
 assert.equal(element("owner-workspace").hidden,false);
 assert.equal(element("owner-key").value,"");
 assert.equal(element("go").disabled,true); // still needs photo+consent
});
