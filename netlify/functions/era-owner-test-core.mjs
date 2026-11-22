import {createHash,timingSafeEqual} from "node:crypto";
import {getStore} from "@netlify/blobs";

// Fail-closed owner-only test authorization. Never include secrets in URLs,
// browser source, logs, analytic events or persistent client storage.
export const MAX_TEST_IMAGES=40; // 40 x 2 credits = 80 credits
export const MAX_TEST_VIDEOS=4;  // 4 x 25 credits = 100 credits
const authHash=value=>createHash("sha256").update(value).digest();
export function ownerConfigured(){
  return process.env.KIVZUNO_OWNER_TEST_ENABLED==="owner-approved" &&
    typeof process.env.KIVZUNO_OWNER_TEST_SECRET==="string" &&
    process.env.KIVZUNO_OWNER_TEST_SECRET.length>=32 &&
    !!process.env.RUNWAYML_API_SECRET;
}
export function ownerAuthorized(request){
  if(!ownerConfigured())return false;
  const provided=request.headers.get("x-kivzuno-owner-key")||"";
  if(provided.length<32 || provided.length>256)return false;
  return timingSafeEqual(authHash(provided),authHash(process.env.KIVZUNO_OWNER_TEST_SECRET));
}
export function ownerBudgetStore(){
  return getStore({name:"kivzuno-owner-test-budget-v1",region:"eu-central-1",consistency:"strong"});
}
// Shared, lifetime slots across preview and production. Atomic onlyIfNew
// limits billable attempts even when browsers send concurrent requests.
export async function claimOwnerTestSlot(kind){
  const limit=kind==="image"?MAX_TEST_IMAGES:kind==="video"?MAX_TEST_VIDEOS:0;
  if(!limit)throw new Error("invalid_test_kind");
  const budget=ownerBudgetStore();
  for(let n=1;n<=limit;n++){
    const claim=await budget.setJSON(kind+"/slot/"+n,{used:true,date:new Date().toISOString()},{onlyIfNew:true});
    if(claim.modified)return {slot:n,total:limit};
  }
  throw new Error(kind+"_test_budget_exhausted");
}
export function ownerPublicCapability(request){
  return {
    ownerTesting:ownerAuthorized(request),
    requiresOwnerAccess:true,
    noCheckout:true,
    videoModel:"gen4_turbo",
    videoSeconds:5,
    videoCreditsPerAttempt:25,
    photoCreditsPerAttempt:2,
    ownerImageMaximum:MAX_TEST_IMAGES,
    ownerVideoMaximum:MAX_TEST_VIDEOS
  };
}
