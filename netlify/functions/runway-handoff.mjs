import { getStore } from "@netlify/blobs";
import {reply, parseImage, ERAS, MODEL, RATIO, DURATION, promptForEra, verifyPaidOrder, isOrderId, IMAGE_MAX_BYTES} from "./runway-handoff-core.mjs";

// Guardrails: NO external request or billable task until a verified one-time order
// token, explicit enabling flags, AND a Runway API secret are configured server-side.
// There is currently no checkout/webhook to mint such orders.
const runwayBase="https://api.dev.runwayml.com";
const headers=()=>({
  "Authorization":"Bearer "+process.env.RUNWAYML_API_SECRET,
  "X-Runway-Version":"2024-11-06",
  "Content-Type":"application/json"
});
const isEnabled=()=>process.env.KIVZUNO_RUNWAY_PAID_ENABLED==="owner-approved" &&
  !!process.env.RUNWAYML_API_SECRET && !!process.env.KIVZUNO_RUNWAY_ORDER_SIGNING_SECRET;
const orders=()=>getStore({name:"kivzuno-runway-orders-v1",region:"eu-central-1",consistency:"strong"});
const isSameOrigin=request=>request.headers.get("origin")===new URL(request.url).origin;

async function parseBody(request) {
  const size=Number(request.headers.get("content-length")||0);
  if(size>IMAGE_MAX_BYTES+16000)throw new Error("size");
  const raw=await request.text();
  if(raw.length>IMAGE_MAX_BYTES+16000)throw new Error("size");
  try {return JSON.parse(raw);}catch {throw new Error("json");}
}
const receiptValid=(receipt,hash)=>verifyPaidOrder(
  receipt,hash,process.env.KIVZUNO_RUNWAY_ORDER_SIGNING_SECRET
);
async function callRunway(method,path,body) {
  const res=await fetch(runwayBase+path,{
    method,headers:headers(),body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(25000)
  });
  const data=await res.json().catch(()=>null);
  if(!res.ok)throw new Error("runway_"+res.status);
  return data;
}

export default async function handler(request) {
  if(request.method!=="POST")return reply({error:"method"},405);
  if(!isSameOrigin(request))return reply({error:"origin"},403);
  let body;
  try {body=await parseBody(request);}catch(e){return reply({error:e.message==="size"?"size":"json"},400);}
  if(!body || typeof body!=="object")return reply({error:"body"},400);
  const action=body.action;

  // The free integration check sends the actual generated image to the Netlify Function,
  // verifies usable Runway bytes and discards them. ZERO calls to Runway, ZERO credits.
  if(action==="preflight"){
    if(!Object.hasOwn(ERAS,body.era))return reply({error:"era"},400);
    let image;
    try{image=parseImage(body.image);}catch(e){return reply({error:e.message},400);}
    return reply({
      ready:true,
      photoTransferred:true,
      bytes:image.bytes,
      imageHash:image.sha256,
      model:MODEL,duration:DURATION,ratio:RATIO,
      provider:"Runway",
      charged:false,
      paymentActive:false,
      message:"KIVZUNO received and validated the AI photo without storing it. Runway generation is NOT active; a verified payment/owner approval and server-only API key are needed."
    });
  }
  // Reject paid operations BEFORE any work if billing gates are inactive.
  if(!["start","status"].includes(action))return reply({error:"action"},400);
  if(!isEnabled())return reply({error:"paid_runway_not_enabled",message:"No checkout or paid Runway generation is active."},503);

  const receipt=body.receipt;
  if(action==="start"){
    if(!Object.hasOwn(ERAS,body.era))return reply({error:"era"},400);
    let image;
    try{image=parseImage(body.image);}catch(e){return reply({error:e.message},400);}
    if(!receiptValid(receipt,image.sha256))return reply({error:"payment_required"},402);
    let store;
    try {
      store=orders();
      // Permanent claim BEFORE calling billable provider. A repeated/parallel call
      // with the same order cannot start another billable task, even if provider fails.
      const claim=await store.setJSON("order/"+receipt.orderId,{
        status:"CLAIMED",imageHash:image.sha256,era:body.era,createdAt:new Date().toISOString()
      },{onlyIfNew:true});
      if(!claim.modified)return reply({error:"already_claimed",message:"Generation already requested for this paid order. Do not retry."},409);
    }catch {return reply({error:"order_store_unavailable"},503);}
    try {
      const task=await callRunway("POST","/v1/image_to_video",{
        model:MODEL,promptImage:image.dataUri,promptText:promptForEra(body.era),
        ratio:RATIO,duration:DURATION
      });
      if(!/^[a-fA-F0-9-]{36}$/.test(task?.id||""))throw new Error("invalid_task_id");
      await store.setJSON("order/"+receipt.orderId,{
        status:"SUBMITTED",taskId:task.id,imageHash:image.sha256,era:body.era,createdAt:new Date().toISOString()
      });
      return reply({status:"SUBMITTED",orderId:receipt.orderId,model:MODEL,duration:DURATION},202);
    }catch {
      // Never automatically retry a possibly billed generation.
      try {await store.setJSON("order/"+receipt.orderId,{status:"REVIEW_REQUIRED",imageHash:image.sha256});}catch{}
      return reply({error:"provider_or_storage_failed",message:"Order claimed; no automatic retry to avoid duplicate charges. Contact support."},502);
    }
  }

  // Receipt binds this order to the photo hash and expires within 24 hours.
  // No publicly readable Runway task details without that paid receipt.
  if(!receipt || !isOrderId(receipt.orderId) || !receiptValid(receipt,body.imageHash))return reply({error:"payment_required"},402);
  try {
    const job=await orders().get("order/"+receipt.orderId,{type:"json",consistency:"strong"});
    if(!job || job.imageHash!==receipt.imageHash)return reply({error:"not_found"},404);
    if(job.status!=="SUBMITTED" || !job.taskId)return reply({status:job.status||"PENDING"});
    const task=await callRunway("GET","/v1/tasks/"+encodeURIComponent(job.taskId));
    const state=String(task?.status||"UNKNOWN");
    if(state==="SUCCEEDED"){
      const video=Array.isArray(task.output) ? task.output.find(x=>typeof x==="string" && x.startsWith("https://")) : null;
      return reply({status:"SUCCEEDED",videoUrl:video||null,expires:true,
        message:"Runway output URLs expire in 24–48 hours. Download promptly. Persistent storage is not implemented."});
    }
    return reply({status:state==="FAILED"?"FAILED":"PROCESSING"});
  }catch {return reply({error:"provider_unavailable"},503);}
}
export const config={rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:12}};
