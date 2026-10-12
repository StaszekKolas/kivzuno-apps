import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {parseImage, ERAS, MODEL, RATIO, DURATION, promptForEra, signPaidOrder, verifyPaidOrder} from "../netlify/functions/runway-handoff-core.mjs";

const frontend=readFileSync("hub/era-motion/studio-simple.js","utf8");
const script=readFileSync("hub/era-motion/studio-simple.js","utf8");
const html=readFileSync("hub/era-motion/index.html","utf8");
const backend=readFileSync("netlify/functions/runway-handoff.mjs","utf8");
const validJpeg=Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(3000,42),Buffer.from([255,217])]);
const jpegData="data:image/jpeg;base64,"+validJpeg.toString("base64");

test("Runway 5s video uses documented Gen4 Turbo parameters and all 12 allowed eras",()=>{
  assert.equal(MODEL,"gen4_turbo");
  assert.equal(RATIO,"720:1280");
  assert.equal(DURATION,5);
  assert.equal(Object.keys(ERAS).length,12);
  assert.match(promptForEra("west"),/Wild West/);
  assert.throws(()=>promptForEra("injected"),/era/);
});
test("handoff accepts a small actual JPEG Data URI and hashes bytes, not user text",()=>{
  const image=parseImage(jpegData);
  assert.equal(image.bytes,validJpeg.length);
  assert.equal(image.sha256,createHash("sha256").update(validJpeg).digest("hex"));
  assert.equal(image.dataUri,jpegData);
  assert.equal(image.mime,"jpeg");
});
test("invalid or excessive image data cannot be sent to a paid model",()=>{
  assert.throws(()=>parseImage("https://example.org/untrusted-image.jpg"));
  assert.throws(()=>parseImage("data:image/jpeg;base64,"+Buffer.alloc(5000,0).toString("base64")),/image_bytes/);
  assert.throws(()=>parseImage("data:image/svg+xml;base64,"+Buffer.alloc(5000).toString("base64")),/image_format/);
  assert.throws(()=>parseImage("data:image/jpeg;base64,"+"A".repeat(5_000_001)),/image_size/);
});
test("Runway one-order signed entitlement fails closed unless signature, hash and time match",()=>{
  const secret="test-only-secret-not-used-in-prod";
  const now=1_800_000_000_000;
  const order={orderId:"paid_order_1234567890",imageHash:parseImage(jpegData).sha256,expiresAt:now+3600_000};
  const signature=signPaidOrder(order,secret);
  assert.equal(verifyPaidOrder({...order,signature},order.imageHash,secret,now),true);
  assert.equal(verifyPaidOrder({...order,signature},order.imageHash,"different",now),false);
  assert.equal(verifyPaidOrder({...order,signature}, "0".repeat(64),secret,now),false);
  assert.equal(verifyPaidOrder({...order,signature:"f".repeat(64)},order.imageHash,secret,now),false);
  assert.equal(verifyPaidOrder({...order,signature},order.imageHash,secret,now+24*3600_000),false);
  assert.equal(verifyPaidOrder({...order,expiresAt:now+3*86400_000,signature},order.imageHash,secret,now),false);
});
test("single-screen browser validates selected photo without billable provider calls",()=>{
  assert.ok(html.includes('id="consent"'));
  assert.ok(html.includes('id="go"'));
  assert.ok(html.includes('studio-simple.js'));
  assert.ok(frontend.includes('action:"preflight",image:img,era:chosen'));
  assert.ok(frontend.includes('dataUri=""'));
  assert.ok(frontend.includes('result.charged!==false'));
  assert.ok(frontend.includes('!dataUri||!consent.checked'));
  assert.ok(frontend.includes('canvas.toDataURL("image/jpeg",quality)'));
  assert.ok(!frontend.includes("RUNWAYML_API_SECRET"));
  assert.ok(!frontend.includes("localStorage"));
  assert.equal((html.match(/type="file"/g)||[]).length,1);
});
test("server preflight cannot bill; actual generation has secret+owner approval+payment gates",()=>{
  assert.match(backend,/if\(action==="preflight"\)/);
  assert.match(backend,/charged:false/);
  const start=backend.indexOf('if(action==="start")');
  const check=backend.indexOf('if(!isEnabled())return reply(');
  assert.ok(check>=0 && start>check,"paid gate must execute before start");
  assert.match(backend,/RUNWAYML_API_SECRET/);
  assert.match(backend,/KIVZUNO_RUNWAY_PAID_ENABLED==="owner-approved"/);
  assert.match(backend,/receiptValid\(receipt,image\.sha256\)/);
  assert.match(backend,/onlyIfNew:true/);
  assert.match(backend,/status:"REVIEW_REQUIRED"/);
  assert.match(backend,/new URL\(request\.url\)\.origin/);
  assert.match(backend,/model:MODEL,promptImage:image\.dataUri/);
  assert.match(frontend,/if\(!aiEnabled\)/);
  assert.match(frontend,/action:"start",photo:img,era:chosen,consent:true/);
});
