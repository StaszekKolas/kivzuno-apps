import {getStore} from "@netlify/blobs";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import {reply,ERAS,MODEL,RATIO,DURATION,promptForEra} from "./runway-handoff-core.mjs";
import {requirePrivateOwner} from "./owner-session-core.mjs";

// Owner-only test mode. Each request uses owner's existing prepaid Runway credits.
// No Lemon checkout; no public/customer payment; never automatically retry paid calls.
const MAX_OWNER_VIDEOS_DAILY=2;
const gateway="https://api.dev.runwayml.com";
const jobs=()=>getStore({name:"kivzuno-owner-video-v1",region:"eu-central-1",consistency:"strong"});
const imageJobs=()=>getStore({name:"kivzuno-image-jobs-v1",region:"eu-central-1",consistency:"strong"});
const hash=t=>createHash("sha256").update(t).digest("hex");
const uuid=t=>typeof t==="string" && /^[0-9a-f-]{36}$/i.test(t);
const auth=t=>typeof t==="string" && /^[a-f0-9]{64}$/.test(t);
const day=()=>new Date().toISOString().slice(0,10);
const nextReset=()=>new Date(Date.parse(day()+"T00:00:00.000Z")+86400000).toISOString();
const enabled=()=>process.env.KIVZUNO_OWNER_VIDEO_TEST_ENABLED==="owner-approved"
  && !!process.env.RUNWAYML_API_SECRET
  && process.env.KIVZUNO_PRIVATE_BETA_ENABLED==="owner-approved";
async function runway(method,path,body){
 const response=await fetch(gateway+path,{
   method,headers:{"Authorization":"Bearer "+process.env.RUNWAYML_API_SECRET,
     "X-Runway-Version":"2024-11-06","Content-Type":"application/json"},
   body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(24000)
 });
 if(!response.ok)throw new Error("runway_http_"+response.status);
 return response.json();
}
async function remaining(){
 const q=jobs(),today=day();
 const slots=await Promise.all(Array.from({length:MAX_OWNER_VIDEOS_DAILY},(_,i)=>
   q.get("slot/"+today+"/"+(i+1),{type:"json",consistency:"strong"})
 ));
 return slots.filter(x=>!x).length;
}
async function reserveSlot(){
 const q=jobs(),today=day();
 for(let i=1;i<=MAX_OWNER_VIDEOS_DAILY;i++){
   const claim=await q.setJSON("slot/"+today+"/"+i,{claimed:true},{onlyIfNew:true});
   if(claim.modified)return;
 }
 throw new Error("owner_video_daily_budget");
}
async function parseBody(request){
 if(Number(request.headers.get("content-length")||0)>4096)throw new Error("body");
 const raw=await request.text();if(raw.length>4096)throw new Error("body");
 return JSON.parse(raw);
}
export default async function handler(request){
 if(request.method!=="POST")return reply({error:"method"},405);
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"origin"},403);
 const owner=requirePrivateOwner(request);
 if(!owner.ok)return reply({error:owner.error},owner.status);
 let body;
 try{body=await parseBody(request);}catch{return reply({error:"invalid_body"},400);}
 if(body?.action==="capabilities"){
   const active=enabled();
   try{return reply({available:active,limit:MAX_OWNER_VIDEOS_DAILY,
     remaining:active?await remaining():0,model:MODEL,duration:DURATION,ratio:RATIO,
     ownerOnly:true,freeToVisitor:true,usesOwnerRunwayCredits:true,
     priceCreditsPerFilm:25,checkoutActive:false,resetAt:nextReset()});}
   catch{return reply({available:false,reason:"quota_service_unavailable"},503);}
 }
 if(body?.action!=="start" && body?.action!=="status")return reply({error:"action"},400);
 if(!enabled())return reply({error:"owner_video_not_enabled"},503);
 if(body.action==="start"){
   if(!uuid(body.imageJobId)||!auth(body.imageAccessToken)
      ||!Object.hasOwn(ERAS,body.era)||body.consent!==true)return reply({error:"invalid_video_input"},400);
   let photo;
   try{
     photo=await imageJobs().get("image/"+body.imageJobId,{type:"json",consistency:"strong"});
   }catch{return reply({error:"image_store_unavailable"},503);}
   if(!photo || photo.authHash!==hash(body.imageAccessToken) || !photo.ownerTask ||
     photo.era!==body.era || Date.now()-photo.createdAt>24*60*60*1000)
     return reply({error:"image_session_expired_or_invalid"},403);
   let imageUrl;
   try{
     const source=await runway("GET","/v1/tasks/"+encodeURIComponent(photo.ownerTask));
     if(source.status!=="SUCCEEDED")return reply({error:"image_not_ready"},409);
     imageUrl=Array.isArray(source.output)?source.output.find(u=>typeof u==="string"&&u.startsWith("https://")):null;
     if(!imageUrl)throw Error();
   }catch{return reply({error:"runway_image_not_available"},503);}
   const q=jobs(),key="from-image/"+body.imageJobId;
   // Claim image once before any video spend; no duplicate film billing.
   try{
     const claim=await q.setJSON(key,{state:"CLAIMED",createdAt:Date.now()},{onlyIfNew:true});
     if(!claim.modified)return reply({error:"video_already_requested_for_photo"},409);
     await reserveSlot();
   }catch(e){return reply({error:e.message==="owner_video_daily_budget"?e.message:"video_job_store_unavailable",resetAt:nextReset()},429);}
   const videoId=randomUUID(),token=randomBytes(32).toString("hex");
   try{
     await q.setJSON("video/"+videoId,{
       hash:hash(token),createdAt:Date.now(),taskId:null,state:"RESERVED",
       sourceJob:body.imageJobId,era:body.era
     },{onlyIfNew:true});
     const video=await runway("POST","/v1/image_to_video",{
       model:MODEL,promptImage:imageUrl,promptText:promptForEra(body.era),
       ratio:RATIO,duration:DURATION
     });
     if(!uuid(video?.id))throw new Error("provider_task_invalid");
     await q.setJSON("video/"+videoId,{
       hash:hash(token),createdAt:Date.now(),taskId:video.id,state:"SUBMITTED",
       sourceJob:body.imageJobId,era:body.era
     });
     await q.setJSON(key,{state:"SUBMITTED",videoId,createdAt:Date.now()});
     return reply({status:"SUBMITTED",videoJobId:videoId,videoAccessToken:token,
       duration:DURATION,model:MODEL},202);
   }catch{
     try{await q.setJSON(key,{state:"REVIEW_REQUIRED",createdAt:Date.now()});}catch{}
     return reply({error:"video_provider_or_storage_failed",message:"Do not retry: a video request may already have used credits."},502);
   }
 }
 if(!uuid(body.videoJobId)||!auth(body.videoAccessToken))return reply({error:"video_access_denied"},403);
 try{
   const job=await jobs().get("video/"+body.videoJobId,{type:"json",consistency:"strong"});
   if(!job||job.hash!==hash(body.videoAccessToken)||Date.now()-job.createdAt>24*60*60*1000)
     return reply({error:"video_session_expired"},403);
   if(!job.taskId)return reply({status:job.state||"PROCESSING"});
   const result=await runway("GET","/v1/tasks/"+encodeURIComponent(job.taskId));
   if(result.status==="SUCCEEDED"){
     const videoUrl=Array.isArray(result.output)?result.output.find(u=>typeof u==="string"&&u.startsWith("https://")):null;
     if(!videoUrl)return reply({error:"video_output_missing"},502);
     return reply({status:"SUCCEEDED",videoUrl,expires:true,
       message:"Save the video promptly. Runway video links are temporary."});
   }
   return reply({status:["FAILED","CANCELED"].includes(result.status)?"FAILED":"PROCESSING"});
 }catch{return reply({error:"video_status_unavailable"},503);}
}
export const config={rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:10}};
