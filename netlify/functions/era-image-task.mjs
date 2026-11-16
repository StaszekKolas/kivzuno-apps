import { getStore } from "@netlify/blobs";
import { randomUUID, randomBytes, createHash, createHmac } from "node:crypto";
import {parseImage,ERAS,reply} from "./runway-handoff-core.mjs";

// READY FOR OWNER'S FUTURE RUNWAY API KEY; ZERO SPEND WHILE DISABLED.
// Images always go through KIVZUNO, with no Puter account, only after explicit upload consent.
// Hard maximum 3 image jobs/day during initial controlled launch. No automatic retries.
const API="https://api.dev.runwayml.com";
const MAX_DAY=3;
const KEY="RUNWAYML_API_SECRET";
const store=()=>getStore({name:"kivzuno-image-jobs-v1",region:"eu-central-1",consistency:"strong"});
const quota=()=>getStore({name:"kivzuno-image-quota-v1",region:"eu-central-1",consistency:"strong"});
// Never serve public AI jobs during private owner testing. Existing flags alone
// are insufficient: only a later, separately approved public launch may enable this.
const enabled=()=>process.env.KIVZUNO_PUBLIC_IMAGE_ENABLED==="owner-approved" &&
  process.env.KIVZUNO_SERVER_IMAGE_ENABLED==="owner-approved" &&
  !!process.env[KEY] && !!process.env.KIVZUNO_IMAGE_QUOTA_SECRET &&
  process.env.KIVZUNO_IMAGE_MAX_DAILY==="3";
const tokenHash=s=>createHash("sha256").update(s).digest("hex");
const authHeaders=()=>({"Authorization":"Bearer "+process.env[KEY],
  "X-Runway-Version":"2024-11-06","Content-Type":"application/json"});
const sameOrigin=req=>req.headers.get("origin")===new URL(req.url).origin;
async function parse(req) {
  const n=Number(req.headers.get("content-length")||0);
  if(n>9_500_000)throw new Error("size");
  const body=await req.text();
  if(body.length>9_500_000)throw new Error("size");
  return JSON.parse(body);
}
const prompt=(e,hasSecond)=>[
  "@main is the primary real subject. Create a completely NEW photorealistic cinematic portrait set in "+ERAS[e]+".",
  hasSecond?"@companion is a second real subject who must appear together with @main, naturally in the same scene.":"",
  "Replace the original landscape, location, attire and background with an era-appropriate scene; do not add borders or captions.",
  "Preserve original person facial identity and pet markings wherever possible. No extra limbs, duplicated heads or split-screen.",
  "Cinematic atmosphere, vertical composition, beautiful natural lighting and photorealistic details."
].filter(Boolean).join(" ");
async function runway(method,path,body) {
  const res=await fetch(API+path,{method,headers:authHeaders(),body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(22000)});
  if(!res.ok)throw new Error("runway_"+res.status);
  return res.json();
}
function idOk(x){return typeof x==="string" && /^[0-9a-f-]{36}$/i.test(x);}
function tokenOk(x){return typeof x==="string" && /^[a-f0-9]{64}$/.test(x);}
async function capacity(req) {
  const ip=req.headers.get("x-nf-client-connection-ip");
  if(!ip || !/^[0-9a-f:.]{2,80}$/i.test(ip))throw new Error("source_ip_unknown");
  const day=new Date().toISOString().slice(0,10);
  const pseudonym=createHmac("sha256",process.env.KIVZUNO_IMAGE_QUOTA_SECRET).update(day+":"+ip).digest("hex");
  const q=quota();
  const once=await q.setJSON("person/"+day+"/"+pseudonym,{used:true},{onlyIfNew:true});
  if(!once.modified)throw new Error("one_image_per_day");
  // Race-safe global quota: claim exactly one exclusive slot across three.
  // We don't retry billable calls after a failed provider response.
  for(let i=1;i<=MAX_DAY;i++){
    const done=await q.setJSON("daily/"+day+"/slot/"+i,{claimed:true},{onlyIfNew:true});
    if(done.modified)return;
  }
  throw new Error("daily_free_image_limit");
}

export default async function handler(request) {
  if(request.method!=="POST")return reply({error:"method"},405);
  if(!sameOrigin(request))return reply({error:"origin"},403);
  let body;
  try {body=await parse(request);}catch {return reply({error:"invalid_body"},400);}
  const action=body?.action;
  // This capability check does not open accounts, charge credits, or expose a secret.
  if(action==="capabilities")return reply({
    available:enabled(),provider:"Runway",model:"gen4_image_turbo",
    loginRequired:false,customerPrice:0,limit:MAX_DAY,
    reason:enabled()?"ready_for_limited_beta":"owner_api_configuration_required",
    billingActive:false, // image generation is funded by the owner (only after explicit owner approval)
    note:"Runway server-side API is disabled until credentials and owner-approved spend cap are configured."
  });
  if(!["start","status"].includes(action))return reply({error:"action"},400);
  if(!enabled())return reply({error:"image_ai_not_configured",message:"No provider API key or approved generation budget is configured."},503);
  if(action==="start"){
    if(!Object.hasOwn(ERAS,body.era)||body.consent!==true)return reply({error:"era_or_consent"},400);
    let main,companion;
    try {
      main=parseImage(body.photo);
      if(body.companion)companion=parseImage(body.companion);
      if(main.dataUri.length+(companion?.dataUri.length||0)>7_000_000)throw new Error("images_too_large");
    }catch(e){return reply({error:String(e.message).slice(0,48)},400);}
    try {await capacity(request);}catch(e){return reply({error:String(e.message)},429);}
    const taskId=randomUUID(),secret=randomBytes(32).toString("hex");
    const jobs=store();
    // Keep only a hash of token, never customer photo. Source images are discarded
    // after submitting to Runway; generated URL expires per provider policy.
    try {
      await jobs.setJSON("image/"+taskId,{
        authHash:tokenHash(secret),ownerTask:null,era:body.era,
        state:"RESERVED",createdAt:Date.now()
      },{onlyIfNew:true});
    }catch{return reply({error:"job_store_unavailable"},503);}
    try {
      const referenceImages=[{uri:main.dataUri,tag:"main"}];
      if(companion)referenceImages.push({uri:companion.dataUri,tag:"companion"});
      const task=await runway("POST","/v1/text_to_image",{
        model:"gen4_image_turbo",ratio:"720:1280",
        promptText:prompt(body.era,Boolean(companion)),referenceImages
      });
      if(!idOk(task?.id))throw new Error("provider_task_invalid");
      await jobs.setJSON("image/"+taskId,{
        authHash:tokenHash(secret),ownerTask:task.id,era:body.era,
        state:"SUBMITTED",createdAt:Date.now()
      });
      return reply({status:"SUBMITTED",jobId:taskId,accessToken:secret},202);
    }catch{
      try{await jobs.setJSON("image/"+taskId,{authHash:tokenHash(secret),state:"REVIEW_REQUIRED",createdAt:Date.now()});}catch{}
      return reply({error:"image_provider_failed",message:"No automatic retry or second charge."},502);
    }
  }
  if(!idOk(body.jobId)||!tokenOk(body.accessToken))return reply({error:"not_authorized"},403);
  try {
    const jobs=store(),job=await jobs.get("image/"+body.jobId,{type:"json",consistency:"strong"});
    if(!job || tokenHash(body.accessToken)!==job.authHash || Date.now()-job.createdAt>24*60*60*1000)return reply({error:"not_found"},404);
    if(!job.ownerTask)return reply({status:job.state||"PROCESSING"});
    const task=await runway("GET","/v1/tasks/"+encodeURIComponent(job.ownerTask));
    if(task.status==="SUCCEEDED"){
      const url=Array.isArray(task.output)?task.output.find(s=>typeof s==="string" && /^https:\/\//.test(s)):null;
      if(!url)return reply({error:"missing_image"},502);
      return reply({status:"SUCCEEDED",imageUrl:url,expires:true});
    }
    return reply({status:task.status==="FAILED"?"FAILED":"PROCESSING"});
  }catch{return reply({error:"provider_unavailable"},503);}
}
export const config={rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:8}};
