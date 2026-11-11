import {getStore} from "@netlify/blobs";
import {randomUUID, randomBytes, createHash, timingSafeEqual} from "node:crypto";
import {ERAS, parseImage, reply, promptForEra, MODEL, RATIO, DURATION} from "./runway-handoff-core.mjs";

// Private owner-only beta. NO public generation, checkout or paid entitlement.
// Usage spends existing Runway Dev API credits, not money collected by KIVZUNO.
// Activation needs three separate, server-only Netlify environment variables.
const API="https://api.dev.runwayml.com";
const IMAGE_CREDITS=2, VIDEO_CREDITS=25;
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
async function reserveCredits(amount,taskId){
  const max=cap(),ledger=budgetStore();
  let claimed=0;
  try{
    for(let i=0;i<max && claimed<amount;i++){
      const result=await ledger.setJSON("credit/"+i,{
        taskId,reservedAt:new Date().toISOString()
      },{onlyIfNew:true});
      if(result.modified)claimed++;
    }
  }catch{throw Error("budget_store_unavailable");}
  if(claimed!==amount)throw Error("budget_exhausted");
}
async function createJob(kind,era,amount,makeProviderTask){
  const jobId=randomUUID(),accessToken=randomBytes(32).toString("hex");
  const job={kind,era,authHash:tokenHash(accessToken),ownerTask:null,
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
      imageCredits:IMAGE_CREDITS,videoCredits:VIDEO_CREDITS,videoSeconds:DURATION,
      budgetCapCredits:owner(request)?cap():null,customerPrice:0,
      note:"Uses existing Runway Dev API credits; no purchases or auto-top-ups are performed."});
  }
  if(!enabled())return reply({error:"owner_beta_not_configured"},503);
  if(!owner(request))return reply({error:"owner_authorization_required"},403);
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
  if(body?.action==="video_start"){
    if(body.consent!==true)return reply({error:"video_consent_required"},400);
    let imageJob;
    try{imageJob=await readAuthorizedJob(body.imageJobId,body.imageAccessToken);}
    catch{return reply({error:"job_store_unavailable"},503);}
    if(!imageJob||imageJob.kind!=="image"||imageJob.state!=="SUBMITTED"||!imageJob.ownerTask)
      return reply({error:"image_job_not_found"},404);
    let imageUrl;
    try{
      const parent=await runway("GET","/v1/tasks/"+encodeURIComponent(imageJob.ownerTask));
      if(parent.status!=="SUCCEEDED")return reply({error:"image_not_ready"},409);
      imageUrl=taskOutput(parent);
      if(!imageUrl)return reply({error:"image_output_missing"},502);
    }catch{return reply({error:"image_provider_unavailable"},503);}
    return createJob("video",imageJob.era,VIDEO_CREDITS,()=>runway("POST","/v1/image_to_video",{
      model:MODEL,promptImage:imageUrl,promptText:promptForEra(imageJob.era),
      ratio:RATIO,duration:DURATION
    }));
  }
  if(body?.action==="status"){
    let job;
    try{job=await readAuthorizedJob(body.jobId,body.accessToken);}
    catch{return reply({error:"job_store_unavailable"},503);}
    if(!job)return reply({error:"not_found"},404);
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
