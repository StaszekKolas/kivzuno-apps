import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const root=readFileSync("hub/index.html","utf8");
const html=readFileSync("hub/era-photo/index.html","utf8");
const script=readFileSync("hub/era-photo/studio.js","utf8");
const redirects=readFileSync("hub/_redirects","utf8");

test("old broken Era Motion removed from visitor hub and link replaced with free photo page",()=>{
  assert.match(root,/\/era-photo\/\?src=/);
  assert.doesNotMatch(root,/\/era-motion\/\?src=/);
  assert.match(redirects,/\/era-motion\/\s+\/era-photo\/\s+302!/);
  assert.match(redirects,/\/era-motion\/index\.html\s+\/era-photo\/\s+302!/);
});

test("new era photo experience really loads and is safe for mobile private preview",()=>{
  assert.match(html,/noindex,nofollow/);
  assert.match(html,/name="viewport"/);
  assert.match(html,/studio\.js\?v=1/);
  assert.match(html,/id="photo"/);
  assert.match(html,/id="create"/);
  assert.match(html,/id="preview"/);
  assert.match(html,/id="download"/);
  assert.match(html,/id="strength"/);
  assert.match(html,/max-width:800px/);
  assert.equal((html.match(/type="file"/g)||[]).length,1);
  assert.equal((html.match(/data-era=/g)||[]).length,6);
});

test("free effect does not misrepresent itself as AI, upload photos or call expensive providers",()=>{
  assert.match(html,/cinematic photo filters, not AI reconstruction/i);
  assert.match(html,/does not replace cars with wagons/i);
  assert.match(html,/stays on this device/i);
  assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket|RUNWAYML_API_SECRET|OPENAI_API_KEY|GEMINI_API_KEY|localStorage|sessionStorage/);
  assert.match(script,/drawCinematicLook\(canvas,loaded,chosen,Number\(strength\.value\)\)/);
  assert.match(script,/canvas\.toBlob/);
  assert.doesNotThrow(()=>new Script(script));
});

test("actual exported JPEG includes small bottom-right KIVZUNO watermark",()=>{
  const start=script.indexOf(" function roundRect(");
  const end=script.indexOf(" function drawCinematicLook(",start);
  assert.ok(start>=0&&end>start,"render helpers should exist");
  const {burnKivzunoWatermark}=new Function(script.slice(start,end)+
    "\nreturn {burnKivzunoWatermark};")();
  let textDraw=null,rectX=null,rectY=null,rectW=null,rectH=null;
  const ctx={
    save(){},restore(){},beginPath(){},moveTo(x,y){rectX=x;rectY=y;},
    lineTo(){},quadraticCurveTo(){},closePath(){},fill(){},
    measureText(text){assert.equal(text,"KIVZUNO");return {width:94};},
    fillText(text,x,y){textDraw={text,x,y,font:this.font,fill:this.fillStyle};}
  };
  burnKivzunoWatermark(ctx,1200,800);
  assert.deepEqual(textDraw&&textDraw.text,"KIVZUNO");
  assert.ok(textDraw.x>1060 && textDraw.x<1200,"watermark is on right");
  assert.ok(textDraw.y>740 && textDraw.y<800,"watermark is near bottom");
  assert.ok(rectX>1000 && rectY>725,"watermark backdrop bottom right");
  assert.match(textDraw.font,/800 /);
  assert.match(script,/drawCinematicLook[\s\S]*burnKivzunoWatermark\(ctx,w,h\)/);
  assert.match(script,/canvas\.toBlob\([\s\S]*"image\/jpeg"/);
});

test("free creator supports six distinct eras, retains photo framing, never forces portrait",()=>{
  for(const id of ["viking","medieval","west","victorian","rome","jazz"])
    assert.match(script,new RegExp("\\b"+id+":\\{filter:"));
  assert.match(script,/const scale=Math\.min\(1,MAX_SIDE\/Math\.max\(loaded\.naturalWidth,loaded\.naturalHeight\)\)/);
  assert.match(script,/canvas\.width=w;canvas\.height=h/);
  assert.match(script,/new Image\(\)/);
  assert.match(script,/URL\.createObjectURL\(file\)/);
  assert.match(script,/MAX_FILE=12\*1024\*1024/);
});
