import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,timingSafeEqual,randomBytes} from "node:crypto";
import {ERAS} from "../netlify/functions/runway-handoff-core.mjs";

const api=readFileSync("netlify/functions/era-owner-test.mjs","utf8");
const ui=readFileSync("hub/era-motion/studio-simple.js","utf8");
const html=readFileSync("hub/era-motion/index.html","utf8");
const promptDefs=api.slice(api.indexOf("const LOOKS="),api.indexOf("const jobs="));
const promptFunctions=new Function("ERAS",promptDefs+";return {scenePrompt,ownerFilmPrompt,validCreative};")(ERAS);
const actions=["walk","animals","gesture","ride","camera"];
const styles=["faithful","cinematic","epic"];
const sceneId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const movieId="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const jobId="cccccccc-cccc-cccc-cccc-cccccccccccc";
const filmJobId="dddddddd-dddd-dddd-dddd-dddddddddddd";
const sceneUrl="https://images.example/converted-scene.jpg";
const token="safe-example-owner-secret-with-32-or-more-characters";
function server(){
  const slots=new Map(),tasks=new Map(),calls=[];
  let issued=0;
  const getStore=({name})=>{
    const bucket=name.includes("credit-reservations")?slots:tasks;
    return {
      async list({prefix}){return {blobs:[...bucket.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))};},
      async get(key){return bucket.get(key)||null;},
      async setJSON(key,value,{onlyIfNew}={}){
        if(onlyIfNew&&bucket.has(key))return {modified:false};
        bucket.set(key,value);return {modified:true};
      }
    };
  };
  const script=api.replace(/^import .*?;\s*$/gm,"")
    .replace("export default async function handler","async function handler")
    .replace("export const config=","const config=");
  const build=new Function("getStore","randomUUID","randomBytes","createHash","timingSafeEqual","ERAS",
    "parseImage","reply","promptForEra","MODEL","RATIO","DURATION","process","fetch","AbortSignal",
    "Buffer","URL",script+";return handler");
  const mockFetch=async(url,options={})=>{
    const body=options.body?JSON.parse(options.body):null;
    calls.push({url,method:options.method,body});
    if(url.endsWith("/v1/text_to_image"))
      return {ok:true,json:async()=>({id:sceneId})};
    if(url.endsWith("/v1/image_to_video"))
      return {ok:true,json:async()=>({id:movieId})};
    if(url.endsWith("/v1/tasks/"+sceneId))
      return {ok:true,json:async()=>({status:"SUCCEEDED",output:[sceneUrl]})};
    if(url.endsWith("/v1/tasks/"+movieId))
      return {ok:true,json:async()=>({status:"SUCCEEDED",output:["https://images.example/clip.mp4"]})};
    throw Error("Unexpected API path "+url);
  };
  const handler=build(getStore,()=>issued++===0?jobId:filmJobId,()=>randomBytes(32),createHash,timingSafeEqual,ERAS,
    photo=>({dataUri:photo,sha256:"a".repeat(64)}), (body,status=200)=>({body,status}),()=>"",
    "gen4_turbo","720:1280",5,
    {env:{KIVZUNO_OWNER_TEST_ENABLED:"owner-approved",RUNWAYML_API_SECRET:"mock",
      KIVZUNO_OWNER_TEST_TOKEN:token,KIVZUNO_OWNER_TEST_BUDGET_CREDITS:"100"}},
    mockFetch,AbortSignal,Buffer,URL);
  const request=(payload,authorized=true)=>({
    method:"POST",url:"https://private.example/.netlify/functions/era-owner-test",
    headers:{get(key){return key==="origin"?"https://private.example":
      key==="authorization"&&authorized?"Bearer "+token:null;}},
    text:async()=>JSON.stringify(payload)
  });
  return {handler,request,calls,slots,tasks};
}
test("every historical era, action and visual style stays within Runway prompt length limits",()=>{
  for(const era of Object.keys(ERAS))
    for(const style of styles)
      for(const action of actions){
        const still=promptFunctions.scenePrompt(era,action,style);
        const movie=promptFunctions.ownerFilmPrompt(era,action,style);
        assert.ok(still.length+68<=1000,era+"/"+style+"/"+action+" still: "+still.length);
        assert.ok(movie.length<=1000,era+"/"+style+"/"+action+" movie: "+movie.length);
        assert.match(still,/@main/);
        assert.match(still,/original crop|original geometry/);
        assert.match(still,/exact human and pet count/);
        assert.doesNotMatch(still,/completely NEW.*portrait/i);
        assert.match(movie,/movement|steps|motion/i);
        assert.equal(promptFunctions.validCreative(era,action,style,"landscape"),true);
      }
});
test("photo preserves source landscape orientation and uses chosen vivid action style",async()=>{
  const app=server();
  const result=await app.handler(app.request({
    action:"image_start",photo:"mock-photo",era:"west",aspect:"landscape",
    look:"cinematic",motion:"animals",consent:true
  }));
  assert.equal(result.status,202);
  assert.equal(app.slots.size,2);
  const requests=app.calls.filter(x=>x.method==="POST");
  assert.equal(requests.length,1);
  assert.ok(requests[0].url.endsWith("/v1/text_to_image"));
  assert.equal(requests[0].body.ratio,"1280:720");
  assert.equal(requests[0].body.referenceImages[0].uri,"mock-photo");
  assert.match(requests[0].body.promptText,/paw|paws/);
  assert.match(requests[0].body.promptText,/vehicle location/);
  assert.match(requests[0].body.promptText,/Cinematic/);
});
test("a film cannot be started before an owner-approved historical scene",async()=>{
  const app=server();
  const detail={photo:"mock-photo",era:"viking",aspect:"landscape",
    look:"epic",motion:"ride",consent:true};
  const before=await app.handler(app.request({action:"film_start",...detail}));
  assert.equal(before.status,409);
  assert.equal(before.body.error,"scene_not_approved");
  assert.equal(app.slots.size,0);
  assert.equal(app.calls.length,0);

  const start=await app.handler(app.request({action:"scene_prepare",...detail}));
  assert.equal(start.status,202);
  assert.equal(app.slots.size,2);
  const first=app.calls.filter(x=>x.method==="POST")[0];
  assert.ok(first.url.endsWith("/v1/text_to_image"));
  assert.match(first.body.promptText,/Norse|Viking/);
  assert.match(first.body.promptText,/Epic/);
  assert.equal(first.body.ratio,"1280:720");

  const status=await app.handler(app.request({
    action:"status",jobId:start.body.jobId,accessToken:start.body.accessToken
  }));
  assert.equal(status.status,200);
  assert.equal(status.body.status,"SUCCEEDED");
  assert.equal(status.body.imageUrl,sceneUrl);
  assert.equal(app.calls.filter(x=>x.method==="POST").length,1,
    "polling must never launch video");
  assert.equal(app.slots.size,2);

  const approve=await app.handler(app.request({
    action:"scene_approve",jobId:start.body.jobId,accessToken:start.body.accessToken
  }));
  assert.equal(approve.status,200);
  assert.equal(approve.body.status,"ALREADY_APPROVED");
  assert.equal(app.calls.filter(x=>x.method==="POST").length,1);
  assert.equal(app.slots.size,2,"approval spends zero credits");

  const lookup=await app.handler(app.request({action:"scene_lookup",...detail}));
  assert.equal(lookup.body.status,"ALREADY_APPROVED");
  assert.equal(lookup.body.jobId,start.body.jobId);
  assert.equal(app.slots.size,2,"reuse lookup spends zero credits");

  const film=await app.handler(app.request({action:"film_start",...detail}));
  assert.equal(film.status,202);
  assert.equal(app.slots.size,27,"2-credit scene plus separately approved 25-credit film");
  const second=app.calls.filter(x=>x.method==="POST")[1];
  assert.ok(second.url.endsWith("/v1/image_to_video"));
  assert.equal(second.body.promptImage,sceneUrl);
  assert.notEqual(second.body.promptImage,"mock-photo");
  assert.equal(second.body.duration,5);
  assert.match(second.body.promptText,/wheels visibly rotate or hooves take steps/);

  const final=await app.handler(app.request({
    action:"status",jobId:film.body.jobId,accessToken:film.body.accessToken
  }));
  assert.equal(final.status,200);
  assert.equal(final.body.status,"REVIEW_REQUIRED");
  assert.ok(final.body.videoUrl.endsWith("clip.mp4"));
  assert.equal(app.slots.size,27);
});
test("invalid styling and missing owner code never call paid provider",async()=>{
  const app=server();
  const invalid=await app.handler(app.request({
    action:"image_start",photo:"mock-photo",era:"west",aspect:"landscape",
    motion:"walk",look:"unapproved_style",consent:true
  }));
  const anon=await app.handler(app.request({
    action:"scene_prepare",photo:"mock-photo",era:"west",aspect:"landscape",
    motion:"walk",look:"cinematic",consent:true
  },false));
  assert.equal(invalid.status,400);
  assert.equal(anon.status,403);
  assert.equal(app.slots.size,0);
  assert.equal(app.calls.length,0);
});
test("both independent modes have a creative style dropdown and movement selector",()=>{
  assert.match(html,/id="look"/);
  assert.match(html,/value="cinematic" selected/);
  assert.match(html,/id="motion"/);
  assert.match(ui,/look:style/);
  assert.match(ui,/look:look\.value/);
  assert.match(ui,/aspect:sourceAspect/);
  assert.match(ui,/action:"scene_prepare"/);
  assert.match(ui,/action:"scene_approve"/);
  assert.match(ui,/action:"film_start"/);
  assert.match(ui,/"image_start"/);
  assert.doesNotMatch(ui,/Why is generation blocked\?/);
});
