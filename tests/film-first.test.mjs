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
  assert.match(html,/WAITS for your approval/);
  assert.match(ui,/selectedProduct==="video"/);
  assert.match(ui,/"image_start"/);
  assert.match(ui,/action:"scene_prepare"/);
  assert.match(ui,/action:"scene_approve"/);
  assert.match(ui,/action:"film_start"/);
  assert.doesNotThrow(()=>new Script(ui));
});
test("film requires separately preparing, approving, and animating the scene",()=>{
  const gate=api.indexOf('if(!owner(request))return reply({error:"owner_authorization_required"},403)');
  const start=api.indexOf('if(body?.action==="scene_prepare")');
  const stat=api.indexOf('if(body?.action==="status")');
  assert.ok(gate>0 && gate<start && start<stat);
  const flow=api.slice(start,stat);
  assert.match(flow,/parseImage\(body\.photo\)/);
  assert.match(flow,/createJob\("scene_prepare",body\.era,IMAGE_CREDITS/);
  assert.match(flow,/\/v1\/text_to_image/);
  assert.match(flow,/scenePrompt\(body\.era,body\.motion,look\)/);
  assert.match(api,/const SCENE_FILM_CREDITS=IMAGE_CREDITS\+VIDEO_CREDITS/);
  assert.doesNotMatch(api,/scene-video-transition\/"/);
  assert.match(api,/onlyIfNew:true/);
  assert.match(api,/model:MODEL,promptImage:approved\.imageUrl/);
  assert.doesNotMatch(api,/body\?\.action==="direct_video_start"/);
});
test("film prompts ask for real action, never just subtle still-frame movement",()=>{
  assert.match(api,/const ACTIONS=Object\.freeze/);
  for(const motion of ["walk","animals","gesture","ride","camera"]){
    assert.match(api,new RegExp(motion+":"));
  }
  assert.match(api,/paw and leg motion/);
  assert.match(api,/wheels visibly rotate or hooves take steps/i);
  assert.match(api,/validCreative\(body\.era,body\.motion,look,body\.aspect\)/);
  assert.match(ui,/genuine motion|real subject movement/);
  assert.match(ui,/NEEDS REVIEW/);
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
