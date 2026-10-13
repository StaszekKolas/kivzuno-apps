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

// Whitelisted owner-only creative controls. This is still one image task per
// photo and two tasks per film, with the same approved 2/27-credit reservations.
// Reference prompting improves fidelity but does not guarantee pixel-perfect editing.
const LOOKS=Object.freeze({
  faithful:"Faithful: maintain the input camera viewpoint, crop, subject scale, all poses and object positions. A small believable action may be visible, but do not rearrange the scene.",
  cinematic:"Cinematic: maintain the input framing and recognizable subjects while capturing a decisive moment of action, strong depth, vivid natural lighting and atmospheric energy.",
  epic:"Epic: keep the original subjects and their positions identifiable, but heighten environmental effects, storytelling tension, scale and dramatic light. Photorealistic, never fantasy caricature."
});
const ACTIONS=Object.freeze({
  walk:{
    still:"A lively instant of purposeful forward motion: walking subjects mid-stride, natural body weight shift, fabric and hair moving in the breeze.",
    movie:"Subjects capable of walking take several clear steps, with visible leg movement and natural body weight changes; others react appropriately without leaving their established positions."
  },
  animals:{
    still:"Capture any animals in the original photo actively striding or pulling, paws raised mid-step, coats moving, tack or leads under tension, dust kicked up by their feet.",
    movie:"Every visible animal actively walks or pulls with repeated visible paw and leg motion, coats and ears responding, leads moving under tension; people or handlers react naturally."
  },
  gesture:{
    still:"Capture the main human mid-gesture, turning or reaching naturally, with clothing reacting and an unmistakable moment of interaction.",
    movie:"The main human turns and makes a visible intentional gesture, with head, arms and clothing changing position naturally; other subjects respond subtly."
  },
  ride:{
    still:"Capture the era-appropriate conveyance in motion: spinning wheels or advancing hooves, dust or spray behind it, subjects interacting naturally.",
    movie:"The era-appropriate vehicle or mount travels forward, wheels visibly rotate or hooves take steps; riders and nearby subjects react naturally."
  },
  camera:{
    still:"Make a strong cinematic action frame with foreground depth, wind, particles and clearly active background atmosphere, not a posed portrait.",
    movie:"The camera tracks laterally by a visible distance with parallax, while original subjects shift naturally and atmospheric dust, smoke or wind moves."
  }
});
const ERA_ATMOSPHERE=Object.freeze({
  west:"frontier street with passing dust, active wagon tracks, wind in period fabrics",
  viking:"working Norse shoreline with moving sea mist, windblown sails and longhouse smoke",
  medieval:"busy muddy castle approach with fluttering pennants, cart tracks and chimney smoke",
  egypt:"sunlit Nile settlement with blowing sand, river sails and an active riverside setting",
  rome:"bustling Roman stone thoroughfare with fluttering banners and market activity",
  renaissance:"lively Italian piazza with flowing fabrics and vivid sunlight between buildings",
  victorian:"wet cobblestones, moving steam and a lively gaslit London street",
  artdeco:"energetic 1920s boulevard with passing classic traffic and theatrical city lights",
  cinema:"1940s dramatic street light, swirling smoke and rich film-noir contrast",
  retro:"busy 1970s street with breeze in clothing and warm late-afternoon light",
  neon:"1980s nightlife street with rain reflections, neon glow and moving mist",
  future:"dynamic futuristic street with rain reflections, dramatic light and moving vapour"
});
function validCreative(era,motion,look,aspect){
  return Object.hasOwn(ERAS,era)&&Object.hasOwn(ACTIONS,motion)&&
    Object.hasOwn(LOOKS,look)&&["landscape","portrait"].includes(aspect);
}
function scenePrompt(era,motion,look){
  return [
    "Edit THIS @main photo into "+ERAS[era]+". Photorealistic cinema still.",
    "KEEP the original camera framing, angle, subject positions, scale, left-to-right order and EXACT count of people and animals. Match real faces and animal markings.",
    "Change modern background, clothes and transport into historical equivalents. Keep the vehicle in the same place and direction, replacing its form with period transport.",
    LOOKS[look],ACTIONS[motion].still,
    "Atmosphere: "+ERA_ATMOSPHERE[era]+".",
    "Capture a vivid mid-action moment, never a posed portrait. Believable hands and paws. No caricatures, duplicated or missing subjects, or text."
  ].join(" ");
}
function ownerFilmPrompt(era,motion,look){
  if(!Object.hasOwn(ERAS,era)||!Object.hasOwn(ACTIONS,motion)||!Object.hasOwn(LOOKS,look))
    throw Error("invalid_motion_or_look");
  return [
    "Animate this already transformed historical scene as one continuous 5-second live-action shot.",
    ACTIONS[motion].movie,
    "Strongly visible natural movement rather than a still-image slideshow.",
    "Keep the original number and identity of people and animals, recognizable faces and coats, period costumes and historical setting. Do not add, remove, swap or morph subjects.",
    look==="faithful"?"Camera mostly stable with authentic subject motion.":
      look==="epic"?"Energetic but coherent tracking camera, lively wind and atmospheric particles.":
        "Natural cinematic camera tracking, wind and environmental motion."
  ].join(" ");
}
const jobs=()=>getStore({name:"kivzuno-owner-beta-jobs-v1",region:"eu-central-1",consistency:"strong"});
const budgetStore=()=>getStore({name:"kivzuno-owner-beta-credit-reservations-v1",region:"eu-central-1",consistency:"strong"});
const hash=s=>createHash("sha256").update(s).digest();
const tokenHash=s=>createHash("sha256").update(s).digest("hex");
const validId=s=>typeof s==="string" && /^[0-9a-f-]{36}$/i.test(s);
const validTaskToken=s=>typeof s==="string" && /^[0-9a-f]{64}$/i.test(s);
// Owner explicitly approved an ADDITIONAL 200 existing Runway Dev credits for
// this private PR #26 beta on 2026-10-13. The original approved 100 reservations
// are kept intact, unchanged and fully traceable. This code must never be merged
// to production or enabled for public customers.
const OWNER_EXTRA_CREDITS_APPROVED=200;
function cap(){
  const base=Number(process.env.KIVZUNO_OWNER_TEST_BUDGET_CREDITS);
  if(!Number.isSafeInteger(base)||base<25||base>1000)return 0;
  // Fail closed unless the originally reviewed budget is still exactly 100.
  // Higher or unexpected env values do not silently authorize more testing.
  if(base!==100)return 0;
  return base+OWNER_EXTRA_CREDITS_APPROVED;
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
function imagePrompt(era,motion,look,companion){
  const text=scenePrompt(era,motion,look)+
    (companion?" Include the @companion as the same recognizable extra subject.":"");
  if(text.length>1000)throw Error("image_prompt_too_long");
  return text;
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
// READ-ONLY OWNER AUDIT: inspect every claimed slot and its saved job record.
// This function never mutates blobs and never calls Runway. The provider's actual
// credits charged cannot be inferred from a reservation or SUBMITTED status.
async function auditReservations(){
  const state=await reservationState();
  const slots=[...state.taken].sort((a,b)=>a-b);
  const counts=new Map();
  let missingSlotEntries=0,invalidReservationRecords=0;
  // Bounded concurrency avoids overloading Netlify Blobs on a free preview.
  for(let i=0;i<slots.length;i+=10){
    const batch=slots.slice(i,i+10);
    const values=await Promise.all(batch.map(async slot=>({
      slot,value:await state.ledger.get("credit/"+slot,{type:"json",consistency:"strong"})
    })));
    for(const {value} of values){
      if(value===null||value===undefined){missingSlotEntries++;continue;}
      const id=value.taskId;
      if(!validId(id)){invalidReservationRecords++;continue;}
      counts.set(id,(counts.get(id)||0)+1);
    }
  }
  const group={
    image:{jobs:0,credits:0},
    video:{jobs:0,credits:0},
    scene_video:{jobs:0,credits:0},
    unknown:{jobs:0,credits:0}
  };
  const statuses={RESERVED:{jobs:0,credits:0},SUBMITTED:{jobs:0,credits:0},
    REVIEW_REQUIRED:{jobs:0,credits:0},missing_job:{jobs:0,credits:0},
    unexpected_state:{jobs:0,credits:0}};
  let providerIdRecordedCredits=0,missingProviderIdCredits=0;
  let partialReservationJobs=0,partialReservationCredits=0;
  const jobStore=jobs();
  const ids=[...counts.keys()];
  for(let i=0;i<ids.length;i+=10){
    const batch=ids.slice(i,i+10);
    const records=await Promise.all(batch.map(async id=>({
      id,job:await jobStore.get("task/"+id,{type:"json",consistency:"strong"})
    })));
    for(const {id,job} of records){
      const amount=counts.get(id);
      const kind=job?.kind;
      const groupKey=Object.hasOwn(group,kind)?kind:"unknown";
      group[groupKey].jobs++;
      group[groupKey].credits+=amount;
      const stateKey=!job?"missing_job":Object.hasOwn(statuses,job.state)?job.state:"unexpected_state";
      statuses[stateKey].jobs++;
      statuses[stateKey].credits+=amount;
      if(validId(job?.ownerTask))providerIdRecordedCredits+=amount;
      else missingProviderIdCredits+=amount;
      const expected=kind==="scene_video"?SCENE_FILM_CREDITS:
        kind==="image"?IMAGE_CREDITS:kind==="video"?VIDEO_CREDITS:null;
      if(expected!==null&&amount!==expected){
        partialReservationJobs++;
        partialReservationCredits+=amount;
      }
    }
  }
  return {
    readOnly:true,actualProviderCreditsCharged:null,
    cap:state.max,reservedCredits:state.reserved,remainingCredits:state.remaining,
    jobCount:ids.length,byKind:group,bySavedState:statuses,
    withSavedProviderTaskCredits:providerIdRecordedCredits,
    withoutSavedProviderTaskCredits:missingProviderIdCredits,
    partialReservationJobs,partialReservationCredits,
    missingSlotEntries,invalidReservationRecords,
    reconciliationNote:"Saved status and reservations are not proof of Runway charges. Provider task IDs may be missing even when a request was accepted. Do NOT refund, reset or increase limits based on this audit."
  };
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
      budgetCapCredits:owner(request)?cap():null,
      originalBudgetCredits:owner(request)?100:null,
      addedBudgetCredits:owner(request)?OWNER_EXTRA_CREDITS_APPROVED:null,
      customerPrice:0,
      note:"Uses existing Runway Dev API credits; no purchases or auto-top-ups are performed."});
  }
  if(!enabled())return reply({error:"owner_beta_not_configured"},503);
  if(!owner(request))return reply({error:"owner_authorization_required"},403);
  if(body?.action==="budget_status"){
    try{
      const state=await reservationState();
      return reply({cap:state.max,reserved:state.reserved,
        remaining:state.remaining,
        originalBudget:100,additionalApproved:OWNER_EXTRA_CREDITS_APPROVED,
        filmRequired:SCENE_FILM_CREDITS,
        imageRequired:IMAGE_CREDITS,
        note:"Reservations shared across previews, NOT actual provider spending. No change to approved cap."});
    }catch{return reply({error:"budget_store_unavailable"},503);}
  }
  if(body?.action==="audit_reservations"){
    try{return reply(await auditReservations());}
    catch{return reply({error:"audit_storage_unavailable"},503);}
  }
  if(body?.action==="image_start"){
    const look=body.look||"cinematic",motion=body.motion||"walk",
      aspect=body.aspect||"portrait";
    if(!validCreative(body.era,motion,look,aspect)||body.consent!==true)
      return reply({error:"era_motion_look_aspect_or_consent"},400);
    let main,companion;
    try{
      main=parseImage(body.photo);
      if(body.companion)companion=parseImage(body.companion);
      if(main.dataUri.length+(companion?.dataUri.length||0)>7_000_000)throw Error("images_too_large");
    }catch(e){return reply({error:String(e.message).slice(0,48)},400);}
    // Verify prompt before reserving prepaid credits; no provider request on error.
    let prompt;
    try{prompt=imagePrompt(body.era,motion,look,Boolean(companion));}
    catch{return reply({error:"image_prompt_too_long"},400);}
    return createJob("image",body.era,IMAGE_CREDITS,()=>{
      const referenceImages=[{uri:main.dataUri,tag:"main"}];
      if(companion)referenceImages.push({uri:companion.dataUri,tag:"companion"});
      return runway("POST","/v1/text_to_image",{
        model:"gen4_image_turbo",ratio:aspect==="landscape"?"1280:720":"720:1280",
        promptText:prompt,referenceImages
      });
    });
  }
  // Independent user-facing Film AI. Stage 1 builds the chosen era as a still;
  // stage 2 runs image-to-video from that transformed still.
  // No user-visible Photo AI step and no direct raw-photo video fallback.
  if(body?.action==="scene_video_start"){
    const look=body.look||"cinematic";
    if(!validCreative(body.era,body.motion,look,body.aspect)||body.consent!==true)
      return reply({error:"era_motion_aspect_or_consent"},400);
    let source;
    try{source=parseImage(body.photo);}
    catch(e){return reply({error:String(e.message).slice(0,48)},400);}
    const ratio=body.aspect==="landscape"?"1280:720":"720:1280";
    const sceneText=scenePrompt(body.era,body.motion,look);
    if(sceneText.length>1000)return reply({error:"image_prompt_too_long"},400);
    return createJob("scene_video",body.era,SCENE_FILM_CREDITS,
      ()=>runway("POST","/v1/text_to_image",{
        model:"gen4_image_turbo",ratio,
        promptText:sceneText,
        referenceImages:[{uri:source.dataUri,tag:"main"}]
      }),{stage:"SCENE",motion:body.motion,look,ratio});
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
            model:MODEL,promptImage:sceneUrl,promptText:ownerFilmPrompt(job.era,job.motion,job.look||"cinematic"),
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
