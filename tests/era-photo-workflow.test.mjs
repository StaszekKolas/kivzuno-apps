import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const page=readFileSync("hub/era-photo/try.html","utf8");
const js=readFileSync("hub/era-photo/try.js","utf8");
const landing=readFileSync("hub/era-photo/index.html","utf8");

test("owner landing links a separate, honest manual ChatGPT workflow",()=>{
 assert.match(landing,/href="\.\/try\.html">Test manual photo workflow/);
 assert.match(page,/OWNER TEST · MANUAL CHATGPT WORKFLOW/);
 assert.match(page,/not an automatic KIVZUNO AI generator/);
 assert.match(page,/Your uploads remain in this browser/);
 assert.match(page,/https:\/\/chatgpt\.com\//);
 assert.match(page,/KIVZUNO does not receive these files/);
 assert.match(page,/name="viewport"/);
 assert.match(page,/noindex,nofollow/);
 assert.match(page,/src="\.\/try\.js\?v=1"/);
});
test("photo and result never leave client before manual action in ChatGPT",()=>{
 assert.doesNotThrow(()=>new Script(js));
 for(const banned of ["fetch(","XMLHttpRequest","WebSocket","sendBeacon","RUNWAYML_API_SECRET",
                      "OPENAI_API_KEY","localStorage","sessionStorage"])assert.ok(!js.includes(banned),banned);
 assert.match(js,/URL\.createObjectURL\(file\)/);
 assert.match(js,/navigator\.clipboard\.writeText\(val\)/);
 assert.match(page,/accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif"/);
 assert.match(js,/MAX=12\*1024\*1024/);
});
test("prompt matches chosen era and preserves humans, animals, and framing",()=>{
 for(const era of ["viking","medieval","west","victorian","rome","jazz"])
   assert.match(js,new RegExp("\\b"+era+":"));
 for(const look of ["faithful","cinematic","epic"])
   assert.match(js,new RegExp("\\b"+look+":"));
 assert.match(js,/preserve identifiable people and animals/);
 assert.match(js,/exact numbers, coat markings, face likeness/);
 assert.match(js,/Never invent people, pets or vehicles/);
 assert.match(js,/No large logo, no captions/);
});
test("download includes pixel-burned lower-right KIVZUNO mark",()=>{
 const start=js.indexOf("  function roundRect(");
 const end=js.indexOf('  $("watermark").addEventListener',start);
 assert.ok(start>=0&&end>start);
 const f=new Function(js.slice(start,end)+"return {embedWatermark};");
 const {embedWatermark}=f();
 let rendered,block;
 const ctx={
  save(){},restore(){},beginPath(){},moveTo(x,y){block={x,y};},lineTo(){},
  quadraticCurveTo(){},closePath(){},fill(){},
  measureText(t){assert.equal(t,"KIVZUNO");return {width:75};},
  fillText(t,x,y){rendered={t,x,y};}
 };
 embedWatermark(ctx,1200,800);
 assert.equal(rendered.t,"KIVZUNO");
 assert.ok(rendered.x>1050 && rendered.x<1200);
 assert.ok(rendered.y>740 && rendered.y<800);
 assert.ok(block.x>1000 && block.y>720);
 assert.match(js,/ctx\.drawImage\(resultImage,0,0,w,h\);embedWatermark\(ctx,w,h\)/);
 assert.match(js,/canvas\.toBlob\(/);
 assert.match(js,/"image\/jpeg",\.94/);
});
test("workflows remain manual and cost-neutral; no live claims",()=>{
 assert.doesNotMatch(page,/Generate image now|Your AI image is ready/);
 assert.match(page,/No automatic generation or paid API requests/);
 assert.match(page,/This tool cannot generate a historical scene by itself/);
 assert.match(page,/small KIVZUNO mark/);
 assert.match(page,/input type="checkbox"/);
});
