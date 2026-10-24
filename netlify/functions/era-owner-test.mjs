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
  faithful:"Faithful: preserve positions and framing strictly; include only subtle realistic action.",
  cinematic:"Cinematic: preserve identity and original geometry, but capture vibrant action, rich natural light and dramatic depth.",
  epic:"Epic: preserve identity and original geometry; add powerful weather, atmosphere and cinematic tension, never caricature."
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
    "Edit @main into a photorealistic "+ERAS[era]+" film still.",
    "Preserve original crop, camera angle, exact left-right order, positions, human/pet count, faces and coat markings.",
    "Replace modern vehicles, asphalt, buildings, fences and clothes IF PRESENT with era equivalents. Keep existing transport at the SAME spot and direction. Never invent new vehicles.",
    LOOKS[look],ACTIONS[motion].still,
    "Atmosphere: "+ERA_ATMOSPHERE[era]+".",
    "Dynamic action, not posed lineup. Real paws and hands; NO added people, missing animals, caricatures or text."
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
    if(["image","scene_prepare"].includes(kind)&&!metadata.hasCompanion&&
      typeof metadata.photoHash==="string"&&metadata.photoHash.length===64){
      const identity=creativeIdentity(metadata.photoHash,era,metadata.motion,
        metadata.look,metadata.aspect);
      try{
        // This index records a PREPARED scene, not visual approval. Reading it
        // later never starts a new paid request; the original image can be
        // reviewed after an iPhone tab reload.
        await store.setJSON("latest-scene/"+identity,{jobId,createdAt:job.createdAt});
      }catch{
        // The provider might already have charged. Preserve its task instead of
        // discarding the successful submission and tempting an auto retry.
      }
    }
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


function creativeIdentity(photoHash,era,motion,look,aspect){
  return createHash("sha256").update([photoHash,era,motion,look,aspect].join("|")).digest("hex");
}
function approvedIndexKey(identity){return "approved-scene/"+identity;}
async function latestPreparedScene(input,era,motion,look,aspect){
  const identity=creativeIdentity(input.sha256,era,motion,look,aspect);
  const index=await jobs().get("latest-scene/"+identity,{type:"json",consistency:"strong"});
  if(!index||!validId(index.jobId))return null;
  const job=await jobs().get("task/"+index.jobId,{type:"json",consistency:"strong"});
  if(!job||!["image","scene_prepare"].includes(job.kind)||job.hasCompanion||
    job.photoHash!==input.sha256||job.era!==era||job.look!==look||
    job.motion!==motion||job.aspect!==aspect)
    return null;
  if(!validId(job.ownerTask))return {status:"REVIEW_REQUIRED",jobId:index.jobId};
  const task=await runway("GET","/v1/tasks/"+encodeURIComponent(job.ownerTask));
  if(task.status==="FAILED")return {status:"REVIEW_REQUIRED",jobId:index.jobId};
  if(task.status!=="SUCCEEDED")return {status:"PROCESSING",jobId:index.jobId};
  const imageUrl=taskOutput(task);
  if(!imageUrl)return {status:"REVIEW_REQUIRED",jobId:index.jobId};
  return {status:"PREPARED_NEEDS_REVIEW",jobId:index.jobId,imageUrl};
}
async function approvedSceneFor(input,era,motion,look,aspect){
  const identity=creativeIdentity(input.sha256,era,motion,look,aspect);
  const index=await jobs().get(approvedIndexKey(identity),{type:"json",consistency:"strong"});
  if(!index||!validId(index.jobId)||!Number.isSafeInteger(index.approvedAt))
    return null;
  const source=await jobs().get("task/"+index.jobId,{type:"json",consistency:"strong"});
  if(!source||!["image","scene_prepare"].includes(source.kind)||!validId(source.ownerTask)||
    source.approvedAt!==index.approvedAt||source.photoHash!==input.sha256||
    creativeIdentity(source.photoHash,source.era,source.motion,source.look,source.aspect)!==identity)
    return null;
  const task=await runway("GET","/v1/tasks/"+encodeURIComponent(source.ownerTask));
  if(task.status!=="SUCCEEDED")return null;
  const sceneUrl=taskOutput(task);
  if(!sceneUrl)return null;
  return {jobId:index.jobId,imageUrl:sceneUrl,identity};
}

export default async function handler(request){
  if(request.method!=="POST")return reply({error:"method"},405);
  if(!originOk(request))return reply({error:"origin"},403);
  let body;
  try{body=await parse(request);}catch{return reply({error:"invalid_body"},400);}
  if(body?.action==="capabilities"){
    return reply({available:owner(request),ownerOnly:true,
      imageCredits:IMAGE_CREDITS,scenePreparationCredits:IMAGE_CREDITS,
      videoCredits:VIDEO_CREDITS,filmTotalIfNewScene:SCENE_FILM_CREDITS,
      videoSeconds:DURATION,
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
        filmRequired:VIDEO_CREDITS,
        scenePreparationRequired:IMAGE_CREDITS,
        filmTotalIfNewScene:SCENE_FILM_CREDITS,
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
    },{photoHash:main.sha256,look,motion,aspect,hasCompanion:Boolean(companion)});
  }
  // Film AI stays independent in the UI. It prepares only the two-credit still,
  // NEVER automatically starts the 25-credit animation. The owner reviews and
  // explicitly approves the still before a separate paid film confirmation.
  if(body?.action==="scene_prepare"){
    const look=body.look||"cinematic";
    if(!validCreative(body.era,body.motion,look,body.aspect)||body.consent!==true)
      return reply({error:"era_motion_look_aspect_or_consent"},400);
    let source;
    try{source=parseImage(body.photo);}
    catch(e){return reply({error:String(e.message).slice(0,48)},400);}
    let existing;
    try{existing=await approvedSceneFor(source,body.era,body.motion,look,body.aspect);}
    catch{return reply({error:"scene_lookup_unavailable"},503);}
    if(existing)return reply({status:"ALREADY_APPROVED",kind:"scene_prepare",...existing,estimatedCredits:0},200);
    let previous;
    try{previous=await latestPreparedScene(source,body.era,body.motion,look,body.aspect);}
    catch{return reply({error:"scene_history_unavailable"},503);}
    if(previous)return reply({...previous,estimatedCredits:0},200);
    const text=scenePrompt(body.era,body.motion,look);
    if(text.length>1000)return reply({error:"image_prompt_too_long"},400);
    return createJob("scene_prepare",body.era,IMAGE_CREDITS,
      ()=>runway("POST","/v1/text_to_image",{
        model:"gen4_image_turbo",
        ratio:body.aspect==="landscape"?"1280:720":"720:1280",
        promptText:text,referenceImages:[{uri:source.dataUri,tag:"main"}]
      }),{photoHash:source.sha256,look,motion:body.motion,aspect:body.aspect});
  }
  if(body?.action==="scene_lookup"){
    const look=body.look||"cinematic";
    if(!validCreative(body.era,body.motion,look,body.aspect))
      return reply({error:"invalid_creative_options"},400);
    let source;
    try{source=parseImage(body.photo);}
    catch{return reply({error:"image_invalid"},400);}
    try{
      const approved=await approvedSceneFor(source,body.era,body.motion,look,body.aspect);
      if(approved)return reply({status:"ALREADY_APPROVED",...approved});
      const latest=await latestPreparedScene(source,body.era,body.motion,look,body.aspect);
      return reply(latest||{status:"NONE"});
    }catch{return reply({error:"scene_lookup_unavailable"},503);}
  }
  if(body?.action==="scene_approve"){
    let source=await readAuthorizedJob(body.jobId,body.accessToken).catch(()=>null);
    // After Safari restarts the ephemeral job token is lost. The owner may
    // still approve the exact same source photo/era/style/action via its
    // SHA-256 index, never by guessing an unrelated job id.
    if(!source&&body.photo){
      let input;
      try{input=parseImage(body.photo);}catch{return reply({error:"approval_photo_invalid"},400);}
      const look=body.look||"cinematic";
      if(!validCreative(body.era,body.motion,look,body.aspect))
        return reply({error:"approval_options_invalid"},400);
      const identity=creativeIdentity(input.sha256,body.era,body.motion,look,body.aspect);
      try{
        const indexed=await jobs().get("latest-scene/"+identity,{type:"json",consistency:"strong"});
        if(indexed?.jobId===body.jobId&&validId(body.jobId))
          source=await jobs().get("task/"+body.jobId,{type:"json",consistency:"strong"});
      }catch{return reply({error:"approval_storage_unavailable"},503);}
    }
    if(!source||!["image","scene_prepare"].includes(source.kind)||source.hasCompanion||
      !validId(source.ownerTask)||!source.photoHash||!source.look||!source.motion||!source.aspect)
      return reply({error:"approval_source_invalid"},403);
    let output;
    try{
      const task=await runway("GET","/v1/tasks/"+encodeURIComponent(source.ownerTask));
      if(task.status!=="SUCCEEDED")return reply({error:"scene_not_finished"},409);
      output=taskOutput(task);
    }catch{return reply({error:"scene_verification_unavailable"},503);}
    if(!output)return reply({error:"scene_output_missing"},409);
    const approvedAt=Date.now();
    const identity=creativeIdentity(source.photoHash,source.era,source.motion,source.look,source.aspect);
    try{
      await jobs().setJSON("task/"+body.jobId,{...source,approvedAt});
      await jobs().setJSON(approvedIndexKey(identity),{jobId:body.jobId,approvedAt});
    }catch{return reply({error:"scene_approval_storage_failed"},503);}
    return reply({status:"ALREADY_APPROVED",kind:"scene_prepare",jobId:body.jobId,
      imageUrl:output,estimatedCredits:0});
  }
  if(body?.action==="film_start"){
    const look=body.look||"cinematic";
    if(!validCreative(body.era,body.motion,look,body.aspect)||body.consent!==true)
      return reply({error:"invalid_creative_options_or_consent"},400);
    let source;
    try{source=parseImage(body.photo);}
    catch{return reply({error:"image_invalid"},400);}
    let approved;
    try{approved=await approvedSceneFor(source,body.era,body.motion,look,body.aspect);}
    catch{return reply({error:"approved_scene_unavailable"},503);}
    if(!approved)return reply({error:"scene_not_approved"},409);
    // Only animation is charged here; the reviewed scene is reused at no image cost.
    return createJob("video",body.era,VIDEO_CREDITS,
      ()=>runway("POST","/v1/image_to_video",{
        model:MODEL,promptImage:approved.imageUrl,
        promptText:ownerFilmPrompt(body.era,body.motion,look),
        ratio:body.aspect==="landscape"?"1280:720":"720:1280",duration:DURATION
      }),{sourceSceneId:approved.jobId,look,motion:body.motion,aspect:body.aspect});
  }
  if(body?.action==="status"){
    let job;
    try{job=await readAuthorizedJob(body.jobId,body.accessToken);}
    catch{return reply({error:"job_store_unavailable"},503);}
    if(!job)return reply({error:"not_found"},404);
    // Legacy auto-animation jobs are deliberately quarantined: do not trigger
    // a new billable video simply because a background status poll is performed.
    if(job.kind==="scene_video")return reply({status:"REVIEW_REQUIRED",stage:"LEGACY_DISABLED",
      reason:"Manual image approval is now required before animation."});
    if(!job.ownerTask)return reply({status:job.state||"REVIEW_REQUIRED",kind:job.kind});
    try{
      const task=await runway("GET","/v1/tasks/"+encodeURIComponent(job.ownerTask));
      if(task.status==="SUCCEEDED"){
        const url=taskOutput(task);
        if(!url)return reply({error:"provider_output_missing"},502);
        // Success at the provider is only a finished file, not passed visual QA.
        // Always mark film Needs Review until the owner inspects genuine motion.
        return reply({status:job.kind==="video"?"REVIEW_REQUIRED":"SUCCEEDED",
          kind:job.kind,
          ...(["image","scene_prepare"].includes(job.kind)?{imageUrl:url}:{videoUrl:url}),
          qualityReviewed:false,expires:true});
      }
      return reply({status:task.status==="FAILED"?"FAILED":"PROCESSING",kind:job.kind});
    }catch{return reply({error:"provider_unavailable"},503);}
  }
  return reply({error:"unknown_action"},400);
}
export const config={rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:60}};
