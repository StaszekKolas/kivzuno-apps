import {getStore} from "@netlify/blobs";
import {randomUUID,randomBytes,createHash} from "node:crypto";
import {reply,ERAS,MODEL,RATIO,DURATION,promptForEra} from "./runway-handoff-core.mjs";
import {ownerConfigured,ownerAuthorized,claimOwnerTestSlot,ownerPublicCapability} from "./era-owner-test-core.mjs";

const API="https://api.dev.runwayml.com";
const imageJobs=()=>getStore({name:"kivzuno-image-jobs-v1",region:"eu-central-1",consistency:"strong"});
const videoJobs=()=>getStore({name:"kivzuno-private-video-jobs-v1",region:"eu-central-1",consistency:"strong"});
const sha=x=>createHash("sha256").update(x).digest("hex");
const idOk=x=>typeof x==="string"&&/^[a-f0-9-]{36}$/i.test(x);
const accessOk=x=>typeof x==="string"&&/^[a-f0-9]{64}$/i.test(x);
async function runway(method,path,data){
 const response=await fetch(API+path,{
  method,headers:{
   "Authorization":"Bearer "+process.env.RUNWAYML_API_SECRET,
   "X-Runway-Version":"2024-11-06","Content-Type":"application/json"
  },
  body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(25000)
 });
 const result=await response.json().catch(()=>null);
 if(!response.ok)throw Error("runway_"+response.status);
 return result;
}
async function json(request){
 const size=Number(request.headers.get("content-length")||0);
 if(size>2500)throw Error("input_too_large");
 const text=await request.text();
 if(text.length>2500)throw Error("input_too_large");
 return JSON.parse(text);
}
export default async function handler(request){
 if(request.method!=="POST")return reply({error:"method"},405);
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"origin"},403);
 let body;
 try{body=await json(request);}catch{return reply({error:"invalid_body"},400);}
 const action=body?.action;
 if(action==="capabilities")return reply({
  ...ownerPublicCapability(request),
  videoAvailable:ownerConfigured()&&ownerAuthorized(request)
 });
 if(!["start","status"].includes(action))return reply({error:"action"},400);
 if(!ownerConfigured())return reply({error:"owner_mode_not_ready"},503);
 if(!ownerAuthorized(request))return reply({error:"owner_access_required"},403);

 if(action==="start"){
  if(!idOk(body.imageJobId)||!accessOk(body.imageAccessToken)||
    !Object.hasOwn(ERAS,body.era)||body.ownerApproval!==true)
   return reply({error:"image_or_approval_required"},400);
  let imageTask;
  try{
   const j=await imageJobs().get("image/"+body.imageJobId,{type:"json",consistency:"strong"});
   if(!j || j.authHash!==sha(body.imageAccessToken) || !idOk(j.ownerTask) ||
      j.era!==body.era || Date.now()-j.createdAt>24*60*60*1000)
      return reply({error:"image_job_not_authorized"},403);
   imageTask=await runway("GET","/v1/tasks/"+encodeURIComponent(j.ownerTask));
   if(imageTask.status!=="SUCCEEDED")return reply({error:"photo_not_finished"},409);
  }catch{return reply({error:"photo_unavailable"},503);}
  const imageUrl=Array.isArray(imageTask.output)
    ?imageTask.output.find(x=>typeof x==="string"&&x.startsWith("https://")):null;
  if(!imageUrl)return reply({error:"photo_link_missing"},502);
  // Claim the specific source image exactly once before a charge.
  // Concurrent taps cannot create duplicate videos from one photo.
  const jobId=randomUUID(),accessToken=randomBytes(32).toString("hex"),jobs=videoJobs();
  try{
   const claim=await jobs.setJSON("source/"+body.imageJobId,{jobId,claimedAt:Date.now()},{onlyIfNew:true});
   if(!claim.modified)return reply({error:"video_already_requested_for_photo"},409);
   await claimOwnerTestSlot("video");
  }catch{return reply({error:"video_test_budget_or_duplicate_claim"},429);}
  try{
   await jobs.setJSON("video/"+jobId,{accessHash:sha(accessToken),state:"RESERVED",
     imageJobId:body.imageJobId,createdAt:Date.now()},{onlyIfNew:true});
   const task=await runway("POST","/v1/image_to_video",{
     model:MODEL,promptImage:imageUrl,promptText:promptForEra(body.era),
     ratio:RATIO,duration:DURATION
   });
   if(!idOk(task?.id))throw Error("task_id_invalid");
   await jobs.setJSON("video/"+jobId,{accessHash:sha(accessToken),state:"SUBMITTED",
     taskId:task.id,imageJobId:body.imageJobId,createdAt:Date.now()});
   return reply({status:"SUBMITTED",videoJobId:jobId,videoAccessToken:accessToken,
      creditsPerAttempt:25,duration:DURATION},202);
  }catch{
   try{await jobs.setJSON("video/"+jobId,{accessHash:sha(accessToken),
     state:"REVIEW_REQUIRED",imageJobId:body.imageJobId,createdAt:Date.now()});}catch{}
   return reply({error:"video_provider_or_storage_failed",message:"No automatic reattempt, to avoid duplicate spending."},502);
  }
 }
 if(!idOk(body.videoJobId)||!accessOk(body.videoAccessToken))
   return reply({error:"not_authorized"},403);
 try{
  const job=await videoJobs().get("video/"+body.videoJobId,{type:"json",consistency:"strong"});
  if(!job || job.accessHash!==sha(body.videoAccessToken)||
    Date.now()-job.createdAt>24*60*60*1000)return reply({error:"not_found"},404);
  if(!job.taskId)return reply({status:job.state||"PENDING"});
  const task=await runway("GET","/v1/tasks/"+encodeURIComponent(job.taskId));
  if(task.status==="SUCCEEDED"){
   const videoUrl=Array.isArray(task.output)
     ?task.output.find(x=>typeof x==="string"&&x.startsWith("https://")):null;
   if(!videoUrl)return reply({error:"video_link_missing"},502);
   return reply({status:"SUCCEEDED",videoUrl,expires:true});
  }
  return reply({status:task.status==="FAILED"?"FAILED":"PROCESSING"});
 }catch{return reply({error:"video_status_unavailable"},503);}
}
export const config={rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:8}};
