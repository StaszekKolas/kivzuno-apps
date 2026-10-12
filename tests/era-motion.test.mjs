import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";

const html=readFileSync("hub/era-motion/index.html","utf8");
const js=readFileSync("hub/era-motion/app.js","utf8");
const css=readFileSync("hub/era-motion/style.css","utf8");
const hub=readFileSync("hub/index.html","utf8");
const metrics=readFileSync("netlify/functions/metrics.mjs","utf8");

test("real AI app is reachable and transparently distinguishes Puter video beta from KIVZUNO checkout",()=>{
  assert.match(hub,/\/era-motion\/\?src=/);
  assert.match(hub,/Puter sign-in and available account credits are required/);
  assert.match(html,/https:\/\/js\.puter\.com\/v2\//);
  assert.match(html,/Puter gives accounts a monthly free allowance, but it is limited/);
  assert.match(html,/agree to send my photos to Puter's AI provider/);
  assert.match(html,/OPTIONAL · REAL AI VIDEO BETA/);
  assert.match(html,/Puter may charge your account/);
  assert.match(html,/KIVZUNO earns £0 from this beta/);
  assert.match(html,/id="video-consent"/);
  assert.match(html,/id="generated-video"/);
  assert.match(html,/id="video-download"/);
  assert.doesNotMatch(html,/checkout is active|Try it free.*film/i);
  assert.match(html,/KIVZUNO never charges you/);
  assert.match(js,/puter\.ai\.txt2img\(generatePrompt\(\),/);
  assert.match(js,/puter\.ai\.txt2vid\(videoPrompt\(\),/);
  assert.match(js,/togetherai:google\/veo-3\.1-lite/);
  assert.match(js,/model:"gpt-image-2"/);
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
  let aiCalls=[],videoCalls=[],authCalls=0,allowVideo=true,signedIn=false,usageCalls=0;
  class E {
    constructor(name=""){this.name=name;this.children=[];this.listeners={};this.dataset={};this.attributes={};this.style={};this.value="";this.checked=false;this.disabled=false;this.hidden=false;this.naturalWidth=1500;this.naturalHeight=1000;this.complete=true;this._src="";this.textContent="";}
    addEventListener(name,listener){this.listeners[name]=listener;}
    setAttribute(name,value){this.attributes[name]=value;}
    removeAttribute(name){delete this.attributes[name];}
    append(...items){this.children.push(...items);}
    remove(){}
    load(){}
    pause(){}
    click(){return this.listeners.click?.();}
    set src(v){this._src=v;if(this.onload)queueMicrotask(()=>this.onload());}
    get src(){return this._src;}
    getContext(){return {drawImage(){}};}
    toDataURL(){return "data:image/jpeg;base64,ZmFrZQ==";}
  }
  const el=id=>{if(!elements.has(id))elements.set(id,new E(id));return elements.get(id);};
  const document={getElementById:el,createElement:tag=>new E(tag),body:{append(){}}};
  const url={createObjectURL:()=>"blob:upload",revokeObjectURL(){}};
  const window={doNotTrack:"1",addEventListener(){},confirm:()=>allowVideo,puter:{
    auth:{
      isSignedIn:()=>signedIn,
      signIn:async()=>{authCalls++;signedIn=true;return true;},
      getMonthlyUsage:async()=>{usageCalls++;return {allowanceInfo:{remaining:250000000,monthUsageAllowance:1000000000}};}
    },
    ai:{txt2img:async (prompt,opts)=>{
      aiCalls.push({prompt,opts});
      return {src:"data:image/png;base64,ZmFrZQ=="};
    },txt2vid:async(prompt,opts)=>{
      videoCalls.push({prompt,opts});
      return {src:"https://media.example.org/rendered-video.mp4"};
    }}
  }};
  const ctxData={document,window,navigator:{doNotTrack:"1"},location:{search:""},
    URL:url,URLSearchParams,Image:E,Blob,Math,Date,
    console,fetch:async()=>({status:204}),
    setTimeout(){},clearTimeout(){}};
  return {el,ctxData,aiCalls,videoCalls,authCount:()=>authCalls,usageCount:()=>usageCalls,setSignedIn:v=>{signedIn=v;},allowVideo:v=>{allowVideo=v;}};
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
  assert.equal(m.el("consent").checked,false,"Uploading a new photo should require renewed explicit consent");
  assert.equal(m.el("generate-btn").disabled,true);
  m.el("consent").checked=true;m.el("consent").listeners.change();
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
  assert.equal(m.aiCalls[0].opts.model,"gpt-image-2");
  assert.equal(m.aiCalls[0].opts.input_images.length,2);
  assert.ok(m.aiCalls[0].opts.input_images.every(a=>a.startsWith("data:image/jpeg;base64,")));
  assert.match(m.aiCalls[0].prompt,/Wild West/);
  assert.match(m.aiCalls[0].prompt,/NOT frame, caption, crop or collage/);
  assert.equal(m.el("generated").hidden,false);
  assert.equal(m.el("download-btn").disabled,false);
  assert.match(m.el("status").textContent,/Real AI image ready/);
});

test("a film cannot be generated without a real AI image and separate credit consent",async()=>{
  const m=mockBrowser();runInNewContext(js,m.ctxData);
  assert.equal(m.el("video-btn").disabled,true);
  m.el("video-consent").checked=true;
  m.el("video-consent").listeners.change();
  assert.equal(m.el("video-btn").disabled,true);
  await m.el("video-btn").click();
  assert.equal(m.videoCalls.length,0);
  assert.equal(m.authCount(),0);
});
test("real video uses generated AI image as starting frame only after separate confirmation",async()=>{
  const m=mockBrowser();runInNewContext(js,m.ctxData);
  await m.el("photo").listeners.change({target:{files:[{size:800,type:"image/jpeg",name:"Polar.jpg"}]}});
  m.el("consent").checked=true;m.el("consent").listeners.change();
  await m.el("generate-btn").click();
  assert.equal(m.el("video-btn").disabled,true);
  m.el("video-consent").checked=true;m.el("video-consent").listeners.change();
  assert.equal(m.el("video-btn").disabled,false);
  m.allowVideo(false);
  await m.el("video-btn").click();
  assert.equal(m.videoCalls.length,0,"User cancelled the credit spending confirmation");
  m.allowVideo(true);
  await m.el("video-btn").click();
  assert.equal(m.videoCalls.length,1);
  assert.equal(m.authCount(),1,"Video should reuse the Puter session established by photo generation");
  assert.equal(m.videoCalls[0].opts.model,"togetherai:google/veo-3.1-lite");
  assert.equal(m.videoCalls[0].opts.seconds,6);
  assert.equal(m.videoCalls[0].opts.input_reference,"data:image/png;base64,ZmFrZQ==");
  assert.equal(m.el("generated-video").hidden,false);
  assert.equal(m.el("video-download").hidden,false);
  assert.equal(m.el("video-btn").disabled,false);
  assert.match(m.el("status").textContent,/real AI video is ready/);
});
test("changing era removes video and requires renewed video consent",async()=>{
  const m=mockBrowser();runInNewContext(js,m.ctxData);
  await m.el("photo").listeners.change({target:{files:[{size:800,type:"image/jpeg",name:"Polar.jpg"}]}});
  m.el("consent").checked=true;m.el("consent").listeners.change();
  await m.el("generate-btn").click();
  m.el("video-consent").checked=true;m.el("video-consent").listeners.change();
  await m.el("video-btn").click();
  m.el("eras").children[4].click();
  assert.equal(m.el("video-download").hidden,true);
  assert.equal(m.el("video-consent").checked,false);
  assert.equal(m.el("video-btn").disabled,true);
  assert.equal(m.el("generated").hidden,true);
});
test("signed-in visitors can generate multiple images without repeating login",async()=>{
  const m=mockBrowser();runInNewContext(js,m.ctxData);
  m.setSignedIn(true);
  await m.el("photo").listeners.change({target:{files:[{size:500,type:"image/jpeg",name:"Polar.jpg"}]}});
  m.el("consent").checked=true;m.el("consent").listeners.change();
  await m.el("generate-btn").click();
  assert.equal(m.authCount(),0);
  await m.el("generate-btn").click();
  assert.equal(m.authCount(),0,"Already signed-in should not open login popup again");
  assert.equal(m.aiCalls.length,2);
});
test("Puter monthly allowance check is read-only and never logs in or generates a video",async()=>{
  const m=mockBrowser();runInNewContext(js,m.ctxData);
  await m.el("balance-btn").click();
  assert.equal(m.authCount(),0);
  assert.equal(m.usageCount(),0);
  assert.match(m.el("balance-status").textContent,/Log in to Puter/);
  m.setSignedIn(true);
  await m.el("balance-btn").click();
  assert.equal(m.authCount(),0);
  assert.equal(m.usageCount(),1);
  assert.equal(m.videoCalls.length,0);
  assert.match(m.el("balance-status").textContent,/25%/);
  assert.match(m.el("balance-status").textContent,/does NOT guarantee enough balance/);
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
