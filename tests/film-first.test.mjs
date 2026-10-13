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
  assert.match(html,/Film AI automatically rebuilds the setting into another era/);
  assert.match(ui,/selectedProduct==="video"/);
  assert.match(ui,/action:"image_start",photo:img,era:chosen,consent:true/);
  assert.match(ui,/action:"scene_video_start",photo:img,era:chosen,/);
  assert.doesNotThrow(()=>new Script(ui));
});
test("independent film internally creates a historical still before animation",()=>{
  const gate=api.indexOf('if(!owner(request))return reply({error:"owner_authorization_required"},403)');
  const start=api.indexOf('if(body?.action==="scene_video_start")');
  const stat=api.indexOf('if(body?.action==="status")');
  assert.ok(gate>0 && gate<start && start<stat);
  const flow=api.slice(start,stat);
  assert.match(flow,/parseImage\(body\.photo\)/);
  assert.match(flow,/createJob\("scene_video",body\.era,SCENE_FILM_CREDITS/);
  assert.match(flow,/\/v1\/text_to_image/);
  assert.match(flow,/sceneImagePrompt\(body\.era\)/);
  assert.match(api,/const SCENE_FILM_CREDITS=IMAGE_CREDITS\+VIDEO_CREDITS/);
  assert.match(api,/scene-video-transition\/"/);
  assert.match(api,/onlyIfNew:true/);
  assert.match(api,/model:MODEL,promptImage:sceneUrl/);
  assert.doesNotMatch(api,/body\?\.action==="direct_video_start"/);
});
test("film prompts ask for real action, never just subtle still-frame movement",()=>{
  assert.match(api,/const FILM_MOTIONS=/);
  for(const motion of ["walk","animals","gesture","ride","camera"]){
    assert.match(api,new RegExp(motion+":"));
  }
  assert.match(api,/legs and paws moving/);
  assert.match(api,/wheels or hooves visibly turn/i);
  assert.match(api,/!Object\.hasOwn\(FILM_MOTIONS,body\.motion\)/);
  assert.match(ui,/genuine motion/);
  assert.match(ui,/has NOT been quality-certified/);
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
