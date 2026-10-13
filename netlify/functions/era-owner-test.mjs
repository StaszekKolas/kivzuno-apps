import {getStore} from "@netlify/blobs";
import {randomUUID, randomBytes, createHash, timingSafeEqual} from "node:crypto";
import {ERAS, parseImage, reply, promptForEra, MODEL, RATIO, DURATION} from "./runway-handoff-core.mjs";

// Private owner-only beta. NO public generation, checkout or paid entitlement.
// Usage spends existing Runway Dev API credits, not money collected by KIVZUNO.
// Activation needs three separate, server-only Netlify environment variables.
const API="https://api.dev.runwayml.com";
const IMAGE_CREDITS=2, VIDEO_CREDITS=25;
const SCENE_FILM_CREDITS=IMAGE_CREDITS+VIDEO_CREDITS;
// Film-first is a one-click user experience, but a TWO-STAGE AI pipeline.
// One budget reservation covers both stages; no automatic retries or fallback to raw-photo animation.

const FILM_MOTIONS=Object.freeze({
  walk:"The main subject walks several clearly visible steps across the scene. Legs and body change position relative to the background. The camera tracks alongside in one continuous live-action shot.",
  animals:"Every visible animal takes distinct steps forward, legs and paws moving in a natural gait. Ears and coats move with the action; people turn their heads while the camera tracks alongside. One continuous live-action shot.",
  gesture:"The main subject turns toward the camera, raises a hand, gives a clear wave and lowers the arm. Head, shoulders and hands visibly change position. One continuous live-action shot.",
  ride:"The cart, vehicle or mount moves forward several meters through the setting. Wheels or hooves visibly turn, dust rises and nearby subjects move in response. The camera follows in one continuous live-action shot.",
  camera:"The camera makes a pronounced sideways tracking move past the subjects, revealing additional surroundings while the subjects turn and react. One continuous cinematic live-action shot."
});
function ownerFilmPrompt(era,motion){
  if(!Object.hasOwn(ERAS,era)||!Object.hasOwn(FILM_MOTIONS,motion))throw Error("invalid_motion");
  return FILM_MOTIONS[motion]+" The scene uses "+ERAS[era]+
    ". Retain recognizable people and animals in the same continuous action.";
}

function sceneImagePrompt(era){
  // Source image serves as identity and group-composition reference, not a background
  // to be animated untouched. The separate video model subsequently animates this still.
  return [
    "Photorealistic cinematic historical scene. The @main image is a reference for ALL subjects and their identities, NOT the location to keep.",
    "Recreate the scene fully in "+ERAS[era]+". Completely replace all present-day buildings, road, vehicles, objects, clothing and signage with era-appropriate equivalents.",
    "Preserve the EXACT NUMBER of visible people and animals, each person's recognizable face, each animal's markings, and their relative placement.",
    "Do not turn anyone into a caricature. No cartoon styling, plastic skin, exaggerated faces, duplicated or missing subjects.",
    "Adapt modern vehicles into credible period transport while keeping the driver's position and all the animals in the scene.",
    "Wide authentic live-action movie still with believable hands, paws, anatomy, natural shadows and a rich clearly historical landscape. No captions or logos."
  ].join(" ");
}
const jobs=()=>getStore({name:"kivzuno-owner-beta-jobs-v1",region:"eu-central-1",consistency:"strong"});
const budgetStore=()=>getStore({name:"kivzuno-owner-beta-credit-reservations-v1",region:"eu-central-1",consistency:"strong"});
const hash=s=>createHash("sha256").update(s).digest();
const tokenHash=s=>createHash("sha256").update(s).digest("hex");
const validId=s=>typeof s==="string" && /^[0-9a-f-]{36}$/i.test(s);
const validTaskToken=s=>typeof s==="string" && /^[0-9a-f]{64}$/i.test(s);
function cap(){
  const n=Number(process.env.KIVZUNO_OWNER_TEST_BUDGET_CREDITS);
  return Number.isSafeInteger(n)&&n>=25&&n<=1000?n:0;
}
function enabled(){
  const secret=process.env.KIVZUNO_OWNER_TEST_TOKEN||"";
  return process.env.KIVZUNO_OWNER_TEST_ENABLED==="owner-approved" &&
    !!process.env.RUNWAYML_API_SECRET && secret.length>=32 && cap()>0;
}
function owner(request){
  if(!enabled())return false;
  const header=request.headers.get("authorization")||"";
  if(!header.startsWith("Bearer "))return false;
  const candidate=header.slice(7);
  if(candidate.length<32 || candidate.length>512)return false;
  return timingSafeEqual(hash(candidate),hash(process.env.KIVZUNO_OWNER_TEST_TOKEN));
}
function originOk(req){return req.headers.get("origin")===new URL(req.url).origin;}
function errCode(e){
  const code=String(e?.message||"");
  if(code==="budget_exhausted")return {status:429,error:"owner_credit_budget_exhausted"};
  if(code==="budget_store_unavailable")return {status:503,error:"budget_store_unavailable"};
  return {status:502,error:"provider_or_storage_failed"};
}
async function parse(request){
  if(Number(request.headers.get("content-length")||0)>9_500_000)throw Error("size");
  const raw=await request.text();
  if(raw.length>9_500_000)throw Error("size");
  return JSON.parse(raw);
}
async function runway(method,path,payload){
  const response=await fetch(API+path,{
    method,
    headers:{Authorization:"Bearer "+process.env.RUNWAYML_API_SECRET,
      "X-Runway-Version":"2024-11-06","Content-Type":"application/json"},
    body:payload?JSON.stringify(payload):undefined,
    signal:AbortSignal.timeout(25000)
  });
  if(!response.ok)throw Error("runway_"+response.status);
  return response.json();
}
function imagePrompt(era,companion){
  return [
    "Create a completely NEW photorealistic cinematic portrait set in "+ERAS[era]+".",
    "The @main reference is the primary real subject.",
    companion?"Include the @companion reference as a second real subject in the same scene.":"",
    "Replace location, original background, period attire and lighting; no collage, frame, borders or captions.",
    "Preserve the person's facial identity and pet coat markings. Avoid duplicated subjects, extra limbs and text.",
    "Vertical cinematic composition, realistic atmosphere and natural lighting."
  ].filter(Boolean).join(" ");
}
// Each 1-credit slot is an atomic onlyIfNew claim. Two concurrent requests cannot
// spend the same part of the pre-approved total cap. Partial claims are deliberately
// never refunded: fail CLOSED rather than possibly billing more than the limit.
// The site-scoped ledger is shared by all Netlify Deploy Previews. A reservation
// is NOT evidence that Runway charged the project. Read-only checks do not reset it.
async function reservationState(){
  const max=cap(), ledger=budgetStore();
  try{
    const {blobs}=await ledger.list({prefix:"credit/"});
    const taken=new Set(
      blobs.map(entry=>entry.key).filter(key=>/^credit\/(0|[1-9][0-9]*)$/.test(key))
        .map(key=>Number(key.slice("credit/".length)))
        .filter(slot=>Number.isSafeInteger(slot)&&slot>=0&&slot<max)
    );
    return {max,taken,reserved:taken.size,remaining:max-taken.size,ledger};
  }catch{throw Error("budget_store_unavailable");}
}
async function reserveCredits(amount,taskId){
  // Check available capacity BEFORE claiming any slots: a denied 27-credit film
  // must not burn the 1-26 reservations remaining after earlier tests.
  const state=await reservationState();
  if(state.remaining<amount)throw Error("budget_exhausted");
  let claimed=0;
  try{
    for(let i=0;i<state.max && claimed<amount;i++){
      if(state.taken.has(i))continue;
      const result=await state.ledger.setJSON("credit/"+i,{
        taskId,reservedAt:new Date().toISOString()
      },{onlyIfNew:true});
      if(result.modified)claimed++;
    }
  }catch{throw Error("budget_store_unavailable");}
  // A concurrent owner request or a failed provider response may still reserve
  // some credits. Intentionally never auto-refund/overwrite historical claims.
  if(claimed!==amount)throw Error("budget_exhausted");
}
async function createJob(kind,era,amount,makeProviderTask,metadata={}){
  const jobId=randomUUID(),accessToken=randomBytes(32).toString("hex");
  const job={kind,era,...metadata,authHash:tokenHash(accessToken),ownerTask:null,
    state:"RESERVED",createdAt:Date.now()};
  const store=jobs();
  try{
    await store.setJSON("task/"+jobId,job,{onlyIfNew:true});
    await reserveCredits(amount,jobId);
  }catch(e){const error=errCode(e);return reply({error:error.error},error.status);}
  try{
    const task=await makeProviderTask();
    if(!validId(task?.id))throw Error("invalid_task");
    await store.setJSON("task/"+jobId,{...job,ownerTask:task.id,state:"SUBMITTED"});
    return reply({status:"SUBMITTED",jobId,accessToken,kind,estimatedCredits:amount},202);
  }catch{
    // Runway might have accepted the task before the network/storage failed.
    // Never retry automatically and never release a possibly spent reservation.
    try{await store.setJSON("task/"+jobId,{...job,state:"REVIEW_REQUIRED"});}catch{}
    return reply({error:"provider_or_storage_failed",message:"No automatic retry; credits may have been used."},502);
  }
}
async function readAuthorizedJob(jobId,accessToken){
  if(!validId(jobId)||!validTaskToken(accessToken))return null;
  const job=await jobs().get("task/"+jobId,{type:"json",consistency:"strong"});
  if(!job || Date.now()-job.createdAt>24*3600_000)return null;
  if(!timingSafeEqual(Buffer.from(tokenHash(accessToken),"hex"),Buffer.from(job.authHash,"hex")))return null;
  return job;
}
function taskOutput(task){
  return Array.isArray(task?.output)
    ? task.output.find(url=>typeof url==="string"&&/^https:\/\//.test(url)) : null;
}

export default async function handler(request){
  if(request.method!=="POST")return reply({error:"method"},405);
  if(!originOk(request))return reply({error:"origin"},403);
  let body;
  try{body=await parse(request);}catch{return reply({error:"invalid_body"},400);}
  if(body?.action==="capabilities"){
    return reply({available:owner(request),ownerOnly:true,
      imageCredits:IMAGE_CREDITS,videoCredits:SCENE_FILM_CREDITS,videoSeconds:DURATION,
      budgetCapCredits:owner(request)?cap():null,customerPrice:0,
      note:"Uses existing Runway Dev API credits; no purchases or auto-top-ups are performed."});
  }
  if(!enabled())return reply({error:"owner_beta_not_configured"},503);
  if(!owner(request))return reply({error:"owner_authorization_required"},403);
  if(body?.action==="budget_status"){
    try{
      const state=await reservationState();
      return reply({cap:state.max,reserved:state.reserved,
        remaining:state.remaining,filmRequired:SCENE_FILM_CREDITS,
        imageRequired:IMAGE_CREDITS,
        note:"Reservations shared across previews, NOT actual provider spending. No change to approved cap."});
    }catch{return reply({error:"budget_store_unavailable"},503);}
  }
  if(body?.action==="image_start"){
    if(!Object.hasOwn(ERAS,body.era)||body.consent!==true)return reply({error:"era_or_consent"},400);
    let main,companion;
    try{
      main=parseImage(body.photo);
      if(body.companion)companion=parseImage(body.companion);
      if(main.dataUri.length+(companion?.dataUri.length||0)>7_000_000)throw Error("images_too_large");
    }catch(e){return reply({error:String(e.message).slice(0,48)},400);}
    return createJob("image",body.era,IMAGE_CREDITS,()=>{
      const referenceImages=[{uri:main.dataUri,tag:"main"}];
      if(companion)referenceImages.push({uri:companion.dataUri,tag:"companion"});
      return runway("POST","/v1/text_to_image",{
        model:"gen4_image_turbo",ratio:"720:1280",
        promptText:imagePrompt(body.era,Boolean(companion)),referenceImages
      });
    });
  }
  // Independent user-facing Film AI. Stage 1 builds the chosen era as a still;
  // stage 2 runs image-to-video from that transformed still.
  // No user-visible Photo AI step and no direct raw-photo video fallback.
  if(body?.action==="scene_video_start"){
    if(!Object.hasOwn(ERAS,body.era)||!Object.hasOwn(FILM_MOTIONS,body.motion)||
      body.consent!==true||!["landscape","portrait"].includes(body.aspect))
      return reply({error:"era_motion_aspect_or_consent"},400);
    let source;
    try{source=parseImage(body.photo);}
    catch(e){return reply({error:String(e.message).slice(0,48)},400);}
    const ratio=body.aspect==="landscape"?"1280:720":"720:1280";
    return createJob("scene_video",body.era,SCENE_FILM_CREDITS,
      ()=>runway("POST","/v1/text_to_image",{
        model:"gen4_image_turbo",ratio,
        promptText:sceneImagePrompt(body.era),
        referenceImages:[{uri:source.dataUri,tag:"main"}]
      }),{stage:"SCENE",motion:body.motion,ratio});
  }
  if(body?.action==="status"){
    let job;
    try{job=await readAuthorizedJob(body.jobId,body.accessToken);}
    catch{return reply({error:"job_store_unavailable"},503);}
    if(!job)return reply({error:"not_found"},404);
    if(job.kind==="scene_video"){
      if(job.state==="REVIEW_REQUIRED")return reply({status:"REVIEW_REQUIRED",stage:job.stage},200);
      if(!job.ownerTask)return reply({status:"REVIEW_REQUIRED",stage:job.stage},200);
      try{
        const task=await runway("GET","/v1/tasks/"+encodeURIComponent(job.ownerTask));
        if(task.status==="FAILED")return reply({status:"FAILED",stage:job.stage},200);
        if(task.status!=="SUCCEEDED")
          return reply({status:"PROCESSING",stage:job.stage},200);
        if(job.stage==="MOVIE"){
          const videoUrl=taskOutput(task);
          if(!videoUrl)return reply({error:"video_output_missing"},502);
          return reply({status:"SUCCEEDED",stage:"MOVIE",kind:"video",videoUrl,expires:true},200);
        }
        if(job.stage!=="SCENE")return reply({status:"REVIEW_REQUIRED",stage:job.stage},200);
        const sceneUrl=taskOutput(task);
        if(!sceneUrl)return reply({status:"REVIEW_REQUIRED",stage:"SCENE"},200);
        // Atomic hand-off lock: only one status poll may submit the billable video.
        // If a transition fails, do not auto retry (the provider may have spent credits).
        const lock=await jobs().setJSON("scene-video-transition/"+body.jobId,
          {lockedAt:new Date().toISOString()},{onlyIfNew:true});
        if(!lock.modified)return reply({status:"PROCESSING",stage:"SCENE"},200);
        try{
          const video=await runway("POST","/v1/image_to_video",{
            model:MODEL,promptImage:sceneUrl,promptText:ownerFilmPrompt(job.era,job.motion),
            ratio:job.ratio,duration:DURATION
          });
          if(!validId(video?.id))throw Error("invalid_video_task");
          await jobs().setJSON("task/"+body.jobId,{...job,stage:"MOVIE",ownerTask:video.id});
          return reply({status:"PROCESSING",stage:"MOVIE"},200);
        }catch{
          try{await jobs().setJSON("task/"+body.jobId,{...job,stage:"MOVIE",state:"REVIEW_REQUIRED",ownerTask:null});}catch{}
          return reply({status:"REVIEW_REQUIRED",stage:"MOVIE"},200);
        }
      }catch{return reply({error:"provider_or_storage_unavailable"},503);}
    }
    if(!job.ownerTask)return reply({status:job.state||"REVIEW_REQUIRED",kind:job.kind});
    try{
      const task=await runway("GET","/v1/tasks/"+encodeURIComponent(job.ownerTask));
      if(task.status==="SUCCEEDED"){
        const url=taskOutput(task);
        if(!url)return reply({error:"provider_output_missing"},502);
        return reply({status:"SUCCEEDED",kind:job.kind,
          ...(job.kind==="image"?{imageUrl:url}:{videoUrl:url}),expires:true});
      }
      return reply({status:task.status==="FAILED"?"FAILED":"PROCESSING",kind:job.kind});
    }catch{return reply({error:"provider_unavailable"},503);}
  }
  return reply({error:"unknown_action"},400);
}
export const config={rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:60}};
