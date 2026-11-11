import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const html=readFileSync("hub/era-motion/index.html","utf8");
const script=readFileSync("hub/era-motion/studio-simple.js","utf8");
const css=readFileSync("hub/era-motion/style.css","utf8");
const hub=readFileSync("hub/index.html","utf8");

test("a single photo studio without legacy providers, vendor login or checkout",()=>{
  assert.match(html,/id="creator"/);
  assert.match(html,/studio-simple\.js/);
  assert.match(html,/id="photo"/);
  assert.match(html,/id="era"/);
  assert.match(html,/id="consent"/);
  assert.match(html,/id="go"/);
  assert.match(html,/id="message"/);
  assert.match(html,/id="original"/);
  assert.match(html,/id="generated-image"/);
  assert.match(html,/id="mode-banner"/);
  assert.doesNotMatch(html,/Puter|Buy my video|LEMON SQUEEZY|runway-bridge\.js|no-login-studio\.js|lemon-status\.js|js\.puter\.com/i);
  assert.doesNotMatch(html,/<form[^>]*checkout|id="kivzuno-buy-film"|js\.puter\.com/i);
  assert.doesNotMatch(html,/js\.puter\.com/i);
  assert.equal((html.match(/type="submit"/g)||[]).length,1);
  assert.equal((html.match(/type="file"/g)||[]).length,1);
});
test("the page tells the truth about inactive AI creation and separate upload test",()=>{
  assert.match(html,/PHOTO STUDIO|photo studio/i);
  assert.match(html,/Without the private owner's code/i);
  assert.match(html,/No login/);
  assert.match(html,/No credits/);
  assert.match(html,/No payment/);
  assert.match(html,/There is no public launch or checkout/i);
});
test("all 12 historical scenes map to the secure server era allow-list",async()=>{
  const {ERAS}=await import("../netlify/functions/runway-handoff-core.mjs");
  const selected=[...html.matchAll(/<option value="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(selected.length,12);
  assert.deepEqual(new Set(selected),new Set(Object.keys(ERAS)));
});
test("Javascript parses and API features are enabled only when confirmed by the server",()=>{
  assert.doesNotThrow(()=>new Script(script));
  assert.match(script,/body\.available===true/);
  assert.match(script,/aiEnabled=Boolean\(enabled\)/);
  assert.match(script,/if\(!aiEnabled\)/);
  assert.match(script,/action:"preflight",image:img,era:chosen/);
  assert.match(script,/action:"image_start",photo:img,era:chosen,consent:true/);
  assert.match(script,/action:"status",jobId:task\.jobId,accessToken:task\.accessToken/);
  assert.match(script,/result\.charged!==false/);
  assert.match(script,/mode\(false\)/);
  assert.match(script,/go\.disabled=busy \|\| videoBusy \|\| !dataUri \|\| !consent\.checked/);
  assert.doesNotMatch(script,/Puter|stripe|lemon|runwayml\.com|localStorage|sessionStorage/i);
});
test("photo is prepared locally, re-encoded and sent only after explicit consent",()=>{
  assert.match(script,/MAX_FILE=12\*1024\*1024/);
  assert.match(script,/canvas\.toDataURL\("image\/jpeg",quality\)/);
  assert.match(script,/JPEG|jpeg/i);
  assert.match(script,/URL\.revokeObjectURL/);
  assert.match(script,/if\(busy\|\|!dataUri\|\|!consent\.checked\)return/);
  assert.match(script,/body:JSON\.stringify\(body\)/);
  assert.doesNotMatch(script,/new Image\(\).*\.src="https/i);
});
test("responsive mobile UI and safe disabled purchase-free experience",()=>{
  assert.match(css,/@media\(max-width:750px\)/);
  assert.match(css,/\.workspace\{grid-template-columns/);
  assert.match(css,/\.primary:disabled/);
  assert.match(html,/type="submit" disabled/);
  assert.match(hub,/\/era-motion\/\?src=/);
});
