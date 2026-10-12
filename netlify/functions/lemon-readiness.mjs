import {validateLemonSignature,isPaidLemonOrder} from "./lemon-commerce-core.mjs";

// Safety default: merchant onboarding and end-to-end payment-to-video fulfillment
// are NOT configured. No checkout is created and no customer is charged.
const json=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{
  "cache-control":"no-store","content-type":"application/json; charset=utf-8"
}});
const merchantConfigured=()=>Boolean(process.env.LEMON_SQUEEZY_API_KEY &&
  process.env.LEMON_SQUEEZY_STORE_ID && process.env.LEMON_SQUEEZY_VARIANT_ID &&
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET);

// Never enable checkout until the owner has personally approved a real money
// activation AND a trusted webhook-to-Runway fulfillment flow has been
// independently verified. That fulfillment flow does not exist yet.
export default async function handler(request) {
  if(request.method!=="POST")return json({error:"method"},405);
  const sameOrigin=request.headers.get("origin")===new URL(request.url).origin;
  if(!sameOrigin)return json({error:"origin"},403);
  let data;
  try {
    if(Number(request.headers.get("content-length")||0)>2048)throw Error();
    const raw=await request.text();
    if(raw.length>2048)throw Error();
    data=JSON.parse(raw);
  }catch{return json({error:"input"},400);}
  if(data?.action==="capabilities"){
    return json({
      provider:"Lemon Squeezy",paymentActive:false,merchantConfigured:merchantConfigured(),
      customerSignupRequired:false,checkoutReady:false,
      reason:"Merchant registration, identity verification and payment-to-video fulfillment are required before live sales.",
      message:"No checkout is enabled, no payment can be taken by KIVZUNO, and no film will be charged for."
    });
  }
  return json({
    error:"checkout_not_active",
    message:"The Lemon Squeezy store is not verified and the automatic paid-film fulfillment has not been enabled. No payment was taken."
  },503);
}
export const config={rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:10}};
