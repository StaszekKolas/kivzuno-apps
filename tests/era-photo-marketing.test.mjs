import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync("hub/era-photo/index.html","utf8");
const hub=readFileSync("hub/index.html","utf8");
const marketing=readFileSync("content/marketing/kivzuno-era-photo-prelaunch-20261013.md","utf8");

test("private preview does not promote broken Era Motion",()=>{
  assert.match(hub,/\/era-photo\/\?src=/);
  assert.doesNotMatch(hub,/href="\/era-motion\/\?src=/);
  assert.match(hub,/EXPLORE THE CONCEPT/);
  assert.match(hub,/Real image generation is not yet enabled/);
});
test("era photo page includes honest prelaunch hero, CTAs, watermark concept",()=>{
  assert.match(page,/<meta name="robots" content="noindex,nofollow">/);
  assert.match(page,/<h1>Your photo/);
  assert.match(page,/Another era/);
  assert.match(page,/href="https:\/\/www\.instagram\.com\/kivzuno\/"/);
  assert.match(page,/Explore the eras/);
  assert.match(page,/KIVZUNO ERA PHOTO · IN DEVELOPMENT/);
  assert.match(page,/AI photo generation is not available yet/);
  assert.match(page,/Our aim is to offer free-to-try images/);
  assert.match(page,/small KIVZUNO watermark/);
  assert.match(page,/class="watermark">KIVZUNO/);
  assert.match(page,/ILLUSTRATIVE CONCEPT · NOT AI OUTPUT/);
  assert.match(page,/@media\(max-width:780px\)/);
  for(const era of ["Viking Age","Medieval","Wild West","Victorian","Ancient Rome","1920s"])
    assert.ok(page.includes(era),era);
});
test("no interactive upload or paid service is falsely advertised as functioning",()=>{
  assert.doesNotMatch(page,/<input[^>]*type="file"/);
  assert.doesNotMatch(page,/<button[^>]*generate/i);
  assert.doesNotMatch(page,/RUNWAYML_API_SECRET|OPENAI_API_KEY|GEMINI_API_KEY|api\.runwayml\.com/);
  assert.doesNotMatch(page,/<script\b/);
  assert.match(page,/No payment, upload, registration or invitation is required/);
});
test("marketing deliverables have five English-only captions, reels, stories and hooks",()=>{
  for(let n=1;n<=5;n++){
    assert.match(marketing,new RegExp("### Post "+n+"(?: —|\\n)"));
  }
  assert.match(marketing,/## English-only posts/);
  assert.doesNotMatch(marketing,/## Polish posts|\*\*Polish:\*\*/);
  assert.match(marketing,/## Short English captions — five alternatives/);
  assert.match(marketing,/ENGLISH-ONLY COPY/);
  assert.match(marketing,/## Instagram Stories — four slides/);
  assert.match(marketing,/## Reels \/ TikTok — 15-second concept script/);
  assert.match(marketing,/## Three short opening hooks/);
  assert.match(marketing,/## Website copy/);
});
test("marketing has clear separate approval gates, no published app promises",()=>{
  assert.match(marketing,/DRAFT ONLY/);
  assert.match(marketing,/AI image-editing backend is \*\*not publicly connected\*\*/);
  assert.match(marketing,/No ads, payments, external test invitations, automated social scheduling or posting/);
  assert.match(marketing,/Do \*\*not\*\* use the owner's original family\/dog photographs/);
  assert.match(marketing,/Launch-day copy — DISABLED UNTIL verified/);
  assert.match(marketing,/small, baked-in KIVZUNO watermark at the lower right/);
});
