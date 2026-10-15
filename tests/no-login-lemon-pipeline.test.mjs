import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHmac} from "node:crypto";
import {validateLemonSignature,isPaidLemonOrder,checkoutPayload} from "../netlify/functions/lemon-commerce-core.mjs";

const img=readFileSync("netlify/functions/era-image-task.mjs","utf8");
const ui=readFileSync("hub/era-motion/studio-simple.js","utf8");
const html=readFileSync("hub/era-motion/index.html","utf8");
const glue=readFileSync("hub/era-motion/studio-simple.js","utf8");
const lemon=readFileSync("netlify/functions/lemon-readiness.mjs","utf8");

test("one-screen flow reuses photo for compatibility check or future AI generation",()=>{
  for(const id of ['creator','consent','go'])assert.ok(html.includes('id="'+id+'"'));
  assert.ok(html.includes("studio-simple.js"));
  assert.ok(glue.includes('action:"preflight",image:img,era:chosen'));
  assert.ok(glue.includes('action:"start",photo:img,era:chosen,consent:true'));
  assert.ok(ui.includes('action:"status",jobId:task.jobId,accessToken:task.accessToken'));
  assert.ok(ui.includes('body.available===true'));
  for(const banned of ['puter.auth','signIn(','RUNWAYML_API_SECRET','LEMON_SQUEEZY_API_KEY','localStorage'])
    assert.ok(!ui.includes(banned));
});
test("owner-funded images remain disabled until credentials and spending ceiling approved",()=>{
  assert.match(img,/KIVZUNO_SERVER_IMAGE_ENABLED==="owner-approved"/);
  assert.match(img,/KIVZUNO_IMAGE_MAX_DAILY==="3"/);
  assert.match(img,/const MAX_DAY=3/);
  assert.match(img,/RUNWAYML_API_SECRET/);
  assert.match(img,/if\(!enabled\(\) \|\| !ownerConfigured\(\)\)return reply\(\{error:"owner_mode_not_ready"/);
  assert.match(img,/onlyIfNew:true/);
  assert.match(img,/one_image_per_day/);
  assert.match(img,/daily_free_image_limit/);
  assert.match(img,/model:"gen4_image_turbo"/);
  assert.match(img,/referenceImages/);
  assert.match(img,/ownerAuthorized\(request\)/);
  assert.match(img,/authHash:tokenHash\(secret\)/);
  assert.match(img,/tokenHash\(body\.accessToken\)!==job\.authHash/);
});
test("Lemon Squeezy webhook signature is SHA256 HMAC of raw body, not attacker-provided JSON",()=>{
  const secret="local-test-secret-000000";
  const payload='{"meta":{"event_name":"order_created"},"data":{"type":"orders"}}';
  const signature=createHmac("sha256",secret).update(payload).digest("hex");
  assert.equal(validateLemonSignature(payload,signature,secret),true);
  assert.equal(validateLemonSignature(payload+" ",signature,secret),false);
  assert.equal(validateLemonSignature(payload,signature,"other"),false);
  assert.equal(validateLemonSignature(payload,"zz",secret),false);
  assert.equal(validateLemonSignature(payload,signature,""),false);
});
test("paid lemon order requires right store, right variant, paid state, positive sum, and order ref",()=>{
  const fixture={meta:{event_name:"order_created",custom_data:{kivzuno_order:"KZ_test_order_12345"}},
    data:{type:"orders",id:"order-1",attributes:{store_id:21,
      first_order_item:{variant_id:67},status:"paid",total:499,test_mode:false}}};
  const opts={storeId:21,variantId:67};
  assert.equal(isPaidLemonOrder(fixture,opts),true);
  assert.equal(isPaidLemonOrder(fixture,{storeId:999,variantId:67}),false);
  assert.equal(isPaidLemonOrder(fixture,{storeId:21,variantId:999}),false);
  assert.equal(isPaidLemonOrder({...fixture,data:{...fixture.data,attributes:{...fixture.data.attributes,status:"refunded"}}},opts),false);
  assert.equal(isPaidLemonOrder({...fixture,data:{...fixture.data,attributes:{...fixture.data.attributes,test_mode:true}}},opts),false);
  assert.equal(isPaidLemonOrder({...fixture,meta:{...fixture.meta,custom_data:{}}},opts),false);
});
test("Lemon checkout creation body includes authenticated custom order reference, no user-managed payment",()=>{
  const payload=checkoutPayload({storeId:"21",variantId:"67",orderRef:"KZ_test_order_12345",returnUrl:"https://kivzuno-hub.netlify.app/era-motion/"});
  assert.equal(payload.data.type,"checkouts");
  assert.equal(payload.data.attributes.checkout_data.custom.kivzuno_order,"KZ_test_order_12345");
  assert.equal(payload.data.relationships.variant.data.id,"67");
  assert.equal(payload.data.relationships.store.data.id,"21");
  assert.throws(()=>checkoutPayload({storeId:"",variantId:2,orderRef:"x",returnUrl:"http://invalid.test"}));
});
test("without registered merchant or completed fulfillment, checkout always returns unavailable",()=>{
  assert.match(lemon,/paymentActive:false/);
  assert.match(lemon,/checkoutReady:false/);
  assert.match(lemon,/error:"checkout_not_active"/);
  assert.doesNotMatch(lemon,/fetch\(["']https:\/\/api\.lemonsqueezy\.com/);
  assert.match(img,/billingActive:false/);
});
