import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const api=readFileSync("netlify/functions/era-owner-test.mjs","utf8");
const ui=readFileSync("hub/era-motion/studio-simple.js","utf8");
const html=readFileSync("hub/era-motion/index.html","utf8");

test("photo and film are separate user-selected products",()=>{
  assert.match(html,/id="photo-choice"/);
  assert.match(html,/id="film-choice"/);
  assert.match(html,/Film AI uses the uploaded photo directly/);
  assert.match(ui,/selectedProduct==="video"/);
  assert.match(ui,/action:"image_start",photo:img,era:chosen,consent:true/);
  assert.match(ui,/action:"direct_video_start",photo:img,era:chosen,motion:motion.value,consent:true/);
  assert.doesNotThrow(()=>new Script(ui));
});
test("direct video starts from uploaded image with owner auth, not generated image task",()=>{
  const gate=api.indexOf('if(!owner(request))return reply({error:"owner_authorization_required"},403)');
  const direct=api.indexOf('if(body?.action==="direct_video_start")');
  const derived=api.indexOf('if(body?.action==="video_start")');
  assert.ok(gate>0 && gate<direct && direct<derived);
  const flow=api.slice(direct,derived);
  assert.match(flow,/parseImage\(body\.photo\)/);
  assert.match(flow,/createJob\("video",body\.era,VIDEO_CREDITS/);
  assert.match(flow,/promptImage:source\.dataUri/);
  assert.doesNotMatch(flow,/imageJob|imageJobId|imageAccessToken/);
});
test("film prompts ask for real action, never just subtle still-frame movement",()=>{
  assert.match(api,/const FILM_MOTIONS=/);
  for(const motion of ["walk","animals","gesture","ride","camera"]){
    assert.match(api,new RegExp(motion+":"));
  }
  assert.match(api,/legs and paws moving/);
  assert.match(api,/wheels or hooves visibly turn/i);
  assert.match(api,/!Object\.hasOwn\(FILM_MOTIONS,body\.motion\)/);
  assert.match(ui,/Check that subjects REALLY MOVE/);
  assert.match(ui,/not passed motion-quality inspection/);
  assert.doesNotMatch(api,/very subtle subject movement/i);
});
test("independent film cannot pay, auto-top up, or leak provider secrets in UI",()=>{
  assert.match(api,/KIVZUNO_OWNER_TEST_ENABLED==="owner-approved"/);
  assert.match(api,/KIVZUNO_OWNER_TEST_BUDGET_CREDITS/);
  assert.match(api,/onlyIfNew:true/);
  assert.match(ui,/window\.confirm/);
  assert.doesNotMatch(ui,/RUNWAYML_API_SECRET|LEMON_SQUEEZY_API_KEY|localStorage|sessionStorage/);
  assert.doesNotMatch(api,/checkoutPayload|STRIPE_SECRET_KEY|LEMON_SQUEEZY_API_KEY/);
});
