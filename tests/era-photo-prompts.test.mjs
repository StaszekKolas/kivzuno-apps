import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ERAS} from "../netlify/functions/runway-handoff-core.mjs";
import {createImagePrompt,ERA_SCENES} from "../netlify/functions/era-photo-prompts.mjs";

const html=readFileSync("hub/era-motion/index.html","utf8");
const script=readFileSync("hub/era-motion/studio-simple.js","utf8");
const backend=readFileSync("netlify/functions/era-image-task.mjs","utf8");

test("all available era prompts are concrete and match public era selection",()=>{
  assert.deepEqual(Object.keys(ERA_SCENES).sort(),Object.keys(ERAS).sort());
  for(const id of Object.keys(ERAS)){
    assert.ok(ERA_SCENES[id].length>75,"era requires enough scenic details "+id);
    const p=createImagePrompt(id);
    assert.ok(p.includes(ERA_SCENES[id]));
    assert.match(p,/natural fur and anatomy/);
    assert.match(p,/recognisably the SAME individual/);
    assert.match(p,/No modern buildings or objects/);
  }
  assert.throws(()=>createImagePrompt("javascript:alert(1)"),/unsupported_era/);
});

test("one or two source images are explicitly identified without unintended blended animals",()=>{
  const one=createImagePrompt("medieval");
  assert.match(one,/@main/);
  assert.doesNotMatch(one,/@companion/);
  assert.match(one,/Do not add other people, pets or animals/);
  const two=createImagePrompt("viking",{hasCompanion:true});
  assert.match(two,/@companion/);
  assert.match(two,/Do not blend identities/);
  assert.match(two,/do NOT dress the animal/);
});

test("working Runway image endpoint reuses verified model and richer prompt helper",()=>{
  assert.match(backend,/createImagePrompt\(body\.era,\{hasCompanion:Boolean\(companion\)\}\)/);
  assert.match(backend,/model:"gen4_image_turbo",ratio:"720:1280"/);
  assert.match(backend,/const MAX_DAY=3/);
  assert.match(backend,/KIVZUNO_SERVER_IMAGE_ENABLED==="owner-approved"/);
  assert.match(backend,/onlyIfNew:true/);
});

test("save, changed era and generated-result affordances never start a generation on their own",()=>{
  assert.match(html,/id="generated-download"/);
  assert.match(html,/id="change-era"/);
  assert.match(html,/id="generated-era"/);
  assert.match(html,/touch and hold it to save to Photos/);
  assert.match(script,/new Image\(\)/);
  assert.match(script,/readyImage\.onload=resolve/);
  assert.match(script,/readyImage\.onerror=/);
  assert.match(script,/generated\.scrollIntoView/);
  assert.match(script,/era\.focus\(\)/);
  assert.match(script,/era\.disabled=busy/);
  assert.match(script,/photo\.disabled=busy/);
  assert.doesNotMatch(script,/change-era".*fetch\(/);
  assert.match(script,/const task=await post\("era-image-task",\{action:"start",photo:img,era:chosen,consent:true\}\)/);
});

test("saving result is explicit, no extra charged action or fabricated download",()=>{
  assert.match(html,/Open full-size image/);
  assert.match(script,/link\.href=status\.imageUrl;link\.hidden=false/);
  assert.match(script,/Generated|generatedImg\.src=status\.imageUrl/);
  assert.doesNotMatch(script,/KIVZUNO_RUNWAY_PAID_ENABLED|LEMON_SQUEEZY_API_KEY/);
});
