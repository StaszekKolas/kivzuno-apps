import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";

const html=readFileSync("hub/era-motion/index.html","utf8");
const js=readFileSync("hub/era-motion/app.js","utf8");
const css=readFileSync("hub/era-motion/style.css","utf8");
const hub=readFileSync("hub/index.html","utf8");
const metrics=readFileSync("netlify/functions/metrics.mjs","utf8");

test("real AI app is reachable and honest about user-pays and unavailable films",()=>{
  assert.match(hub,/\/era-motion\/\?src=/);
  assert.match(hub,/Puter sign-in and available account credits are required/);
  assert.match(html,/https:\/\/js\.puter\.com\/v2\//);
  assert.match(html,/Puter gives accounts a monthly free allowance, but it is limited/);
  assert.match(html,/agree to send my photos to Puter's AI provider/);
  assert.match(html,/Video creation is not available yet/);
  assert.match(html,/KIVZUNO never charges you/);
  assert.match(js,/puter\.ai\.txt2img\(generatePrompt\(\),/);
  assert.doesNotMatch(html,/Save free photo postcard|original photo with a themed frame/i);
  assert.doesNotMatch(js,/MediaRecorder|captureStream|exportVideo|localStorage|sessionStorage|document\.cookie/);
  assert.match(css,/\.ai-result-screen/);
});
test("12 genuinely different era prompts are syntactically valid",()=>{
  assert.doesNotThrow(()=>new Script(js));
  const ids=[...js.matchAll(/\{id:"([^"]+)",\s*name:/g)].map(m=>m[1]);
  assert.equal(ids.length,12);
  assert.equal(new Set(ids).size,12);
  for(const id of ["medieval","west","victorian","future"])assert.ok(ids.includes(id));
  assert.match(js,/regenerate the ENTIRE environment/);
  assert.match(js,/Maintain recognizable facial features/);
});

function mockBrowser(){
  const elements=new Map();
  let aiCalls=[],authCalls=0;
  class E {
    constructor(name=""){this.name=name;this.children=[];this.listeners={};this.dataset={};this.attributes={};this.style={};this.value="";this.checked=false;this.disabled=false;this.hidden=false;this.naturalWidth=1500;this.naturalHeight=1000;this.complete=true;this._src="";this.textContent="";}
    addEventListener(name,listener){this.listeners[name]=listener;}
    setAttribute(name,value){this.attributes[name]=value;}
    removeAttribute(name){delete this.attributes[name];}
    append(...items){this.children.push(...items);}
    remove(){}
    click(){return this.listeners.click?.();}
    set src(v){this._src=v;if(this.onload)queueMicrotask(()=>this.onload());}
    get src(){return this._src;}
    getContext(){return {drawImage(){}};}
    toDataURL(){return "data:image/jpeg;base64,ZmFrZQ==";}
  }
  const el=id=>{if(!elements.has(id))elements.set(id,new E(id));return elements.get(id);};
  const document={getElementById:el,createElement:tag=>new E(tag),body:{append(){}}};
  const url={createObjectURL:()=>"blob:upload",revokeObjectURL(){}};
  const window={doNotTrack:"1",addEventListener(){},puter:{
    auth:{signIn:async()=>{authCalls++;return true;}},
    ai:{txt2img:async (prompt,opts)=>{
      aiCalls.push({prompt,opts});
      return {src:"data:image/png;base64,ZmFrZQ=="};
    }}
  }};
  const ctxData={document,window,navigator:{doNotTrack:"1"},location:{search:""},
    URL:url,URLSearchParams,Image:E,Blob,Math,Date,
    console,fetch:async()=>({status:204}),
    setTimeout(){},clearTimeout(){}};
  return {el,ctxData,aiCalls,authCount:()=>authCalls};
}
test("user must upload photo AND consent before enabling AI",async()=>{
  const m=mockBrowser();
  runInNewContext(js,m.ctxData);
  assert.equal(m.el("eras").children.length,12);
  assert.equal(m.el("generate-btn").disabled,true);
  m.el("consent").checked=true;
  m.el("consent").listeners.change();
  assert.equal(m.el("generate-btn").disabled,true);
  await m.el("photo").listeners.change({target:{files:[{size:1200,type:"image/jpeg",name:"Polar.jpg"}]}});
  assert.equal(m.el("generate-btn").disabled,false);
  m.el("consent").checked=false;
  m.el("consent").listeners.change();
  assert.equal(m.el("generate-btn").disabled,true);
  assert.equal(m.authCount(),0);
  assert.equal(m.aiCalls.length,0);
});
test("real image generation takes 2 reference images and uses selected era scene",async()=>{
  const m=mockBrowser();runInNewContext(js,m.ctxData);
  await m.el("photo").listeners.change({target:{files:[{size:1200,type:"image/jpeg",name:"person.jpg"}]}});
  await m.el("companion").listeners.change({target:{files:[{size:1200,type:"image/png",name:"dog.png"}]}});
  m.el("eras").children[5].click(); // Wild West
  m.el("animal").value="dog";
  m.el("consent").checked=true;m.el("consent").listeners.change();
  await m.el("generate-btn").click();
  assert.equal(m.authCount(),1);
  assert.equal(m.aiCalls.length,1);
  assert.equal(m.aiCalls[0].opts.model,"gpt-image-1-mini");
  assert.equal(m.aiCalls[0].opts.input_images.length,2);
  assert.ok(m.aiCalls[0].opts.input_images.every(a=>a.startsWith("data:image/jpeg;base64,")));
  assert.match(m.aiCalls[0].prompt,/Wild West/);
  assert.match(m.aiCalls[0].prompt,/NOT frame, caption, crop or collage/);
  assert.equal(m.el("generated").hidden,false);
  assert.equal(m.el("download-btn").disabled,false);
  assert.match(m.el("status").textContent,/Real AI image ready/);
});
test("invalid inputs cannot trigger the paid provider",async()=>{
  const m=mockBrowser();runInNewContext(js,m.ctxData);
  await m.el("photo").listeners.change({target:{files:[{size:13*1024*1024,type:"image/png",name:"too-big.png"}]}});
  m.el("consent").checked=true;m.el("consent").listeners.change();
  assert.equal(m.el("generate-btn").disabled,true);
  await m.el("generate-btn").click();
  assert.equal(m.aiCalls.length,0);
});
test("only anonymous known metrics are sent, no photos or payment events",()=>{
  assert.match(metrics,/const apps = \[[^\n]*"eramotion"/);
  assert.match(metrics,/"eramotion"\]\.includes\(app\)/);
  assert.match(js,/JSON\.stringify\(\{app:"eramotion",event,source\}\)/);
  assert.doesNotMatch(js,/fetch\([^)]*selected\.photo/);
});
