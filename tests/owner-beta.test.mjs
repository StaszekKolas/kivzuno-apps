import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const backend=readFileSync("netlify/functions/era-owner-test.mjs","utf8");
const old=readFileSync("netlify/functions/era-image-task.mjs","utf8");
const frontend=readFileSync("hub/era-motion/studio-simple.js","utf8");
const page=readFileSync("hub/era-motion/index.html","utf8");

test("public endpoint needs an entirely separate, currently unset launch flag",()=>{
  assert.match(old,/KIVZUNO_PUBLIC_IMAGE_ENABLED==="owner-approved"/);
  assert.match(old,/KIVZUNO_SERVER_IMAGE_ENABLED==="owner-approved"/);
});
test("private owner beta gates all billable operations with server-side auth and approval",()=>{
  assert.match(backend,/KIVZUNO_OWNER_TEST_ENABLED==="owner-approved"/);
  assert.match(backend,/KIVZUNO_OWNER_TEST_TOKEN/);
  assert.match(backend,/KIVZUNO_OWNER_TEST_BUDGET_CREDITS/);
  assert.match(backend,/timingSafeEqual/);
  assert.match(backend,/if\(!owner\(request\)\)return reply\(\{error:"owner_authorization_required"\},403\)/);
  assert.match(backend,/ownerOnly:true/);
  assert.doesNotMatch(frontend,/RUNWAYML_API_SECRET|localStorage|sessionStorage/i);
});
test("no one-image-per-day quota in owner's path; total credit budget is atomic",()=>{
  assert.doesNotMatch(backend,/one_image_per_day|daily_free_image_limit|MAX_DAY/);
  assert.match(backend,/const IMAGE_CREDITS=2, VIDEO_CREDITS=25/);
  assert.match(backend,/OWNER_EXTRA_CREDITS_APPROVED=200/);
  assert.match(backend,/base!==100\)return 0/);
  assert.match(backend,/return base\+OWNER_EXTRA_CREDITS_APPROVED/);
  assert.match(backend,/setJSON\("credit\/"\+i/);
  assert.match(backend,/onlyIfNew:true/);
  assert.match(backend,/if\(claimed!==amount\)throw Error\("budget_exhausted"\)/);
});
test("image and video are distinct explicit owner-only actions, not checkout",()=>{
  assert.match(backend,/body\?\.action==="image_start"/);
  assert.match(backend,/body\?\.action==="scene_prepare"/);
  assert.match(backend,/body\?\.action==="scene_approve"/);
  assert.match(backend,/body\?\.action==="film_start"/);
  assert.match(backend,/body\.consent!==true/);
  assert.match(backend,/model:MODEL,promptImage:approved\.imageUrl/);
  assert.match(backend,/\/v1\/image_to_video/);
  assert.match(frontend,/"image_start"/);
  assert.match(frontend,/"scene_prepare"/);
  assert.match(frontend,/action:"scene_approve"/);
  assert.match(frontend,/action:"film_start"/);
  assert.match(frontend,/window\.confirm/);
  assert.match(page,/id="owner-key"/);
  assert.match(page,/id="film-choice"/);
  assert.match(page,/id="generated-video"/);
  assert.doesNotMatch(backend,/signPaidOrder|checkoutPayload|LEMON_SQUEEZY/i);
});
