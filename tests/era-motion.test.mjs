import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";

const html=readFileSync("hub/era-motion/index.html","utf8");
const js=readFileSync("hub/era-motion/app.js","utf8");
const css=readFileSync("hub/era-motion/style.css","utf8");
const hub=readFileSync("hub/index.html","utf8");
const metrics=readFileSync("netlify/functions/metrics.mjs","utf8");
const stats=readFileSync("hub/stats.html","utf8");

test("separate working app is discoverable from main hub and honest about limitations",()=>{
  assert.match(hub,/\/era-motion\/\?src=/);
  assert.match(html,/does <b>not yet use generative AI<\/b>/);
  assert.match(html,/photos stay in this browser/i);
  assert.match(html,/Save free photo postcard \(PNG\)/);
  assert.match(html,/Interested in a paid AI film/);
  assert.match(html,/not an AI transformation/);
  assert.doesNotMatch(html,/Try it free.*film|Export 6-second video/i);
  assert.doesNotMatch(js,/MediaRecorder|captureStream|exportVideo/);
  assert.match(html,/<script src="\.\/app\.js" defer><\/script>/);
  assert.ok(css.includes("@media(max-width:440px)"));
  assert.doesNotMatch(html,/<script[^>]+src="https?:\/\//);
  assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie|axios|cloudinary|uploadBytes/i);
});
test("12 era presets are uniquely identified and JavaScript parses",()=>{
  assert.doesNotThrow(()=>new Script(js));
  assert.match(js,/function savePoster\(\)/);
  const ids=[...js.matchAll(/\{id:"([a-z]+)",name:/g)].map(m=>m[1]);
  assert.equal(ids.length,12);
  assert.equal(new Set(ids).size,12);
  for(const important of ["medieval","victorian","artdeco","future"])assert.ok(ids.includes(important));
});
function mockUI(){
  const elements=new Map();
  class E{
    constructor(id){this.id=id;this.children=[];this.listeners={};this.attributes={};this.dataset={};this.style={};this.value="";this.textContent="";this.disabled=false;this.hidden=true;}
    append(...children){this.children.push(...children);}
    addEventListener(name,fn){this.listeners[name]=fn;}
    setAttribute(k,v){this.attributes[k]=v;}
    removeAttribute(k){delete this.attributes[k];}
    click(){this.listeners.click?.();}
    load(){}
  }
  const el=(id)=>{if(!elements.has(id))elements.set(id,new E(id));return elements.get(id);};
  const gradient=()=>({addColorStop(){}});
  const ctx={
    createLinearGradient:gradient,beginPath(){},roundRect(){},fill(){},stroke(){},
    strokeRect(){},fillRect(){},arc(){},save(){},restore(){},clip(){},
    moveTo(){},lineTo(){},translate(){},drawImage(){},fillText(){},
    measureText(s){return {width:String(s).length*19};}
  };
  const canvas=el("scene");
  canvas.width=540;canvas.height=960;canvas.getContext=()=>ctx;
  canvas.toBlob=fn=>fn(new Blob(["PNG"],{type:"image/png"}));
  const document={getElementById:el,createElement:tag=>new E(tag),body:{append(){} }};
  const called=[];
  const window={addEventListener(){},doNotTrack:"1",location:{search:""},URL:{createObjectURL:()=> "blob:preview",revokeObjectURL(){}}};
  const fakeUrl={createObjectURL:()=> "blob:preview",revokeObjectURL(){}};
  class ImageMock{
    constructor(){this.naturalWidth=1500;this.naturalHeight=1000;this.onload=null;this.onerror=null;}
    set src(v){queueMicrotask(()=>this.onload?.());}
  }
  const ctxData={
    document,window,navigator:{doNotTrack:"1",globalPrivacyControl:false},
    URL:fakeUrl,URLSearchParams,Image:ImageMock,Blob,Date,Math,console,
    performance:{now:()=>100},requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    fetch:async (...args)=>{called.push(args);return {status:204};},
    setTimeout:()=>1,clearTimeout(){},
    location:{search:""},MediaRecorder:undefined
  };
  return {el,canvas,ctxData,called};
}
test("app initializes with 12 clickable era buttons and draws preview",()=>{
  const m=mockUI();
  assert.doesNotThrow(()=>runInNewContext(js,m.ctxData));
  const eras=m.el("eras").children;
  assert.equal(eras.length,12);
  assert.equal(eras.filter(x=>x.attributes["aria-pressed"]==="true").length,1);
  eras[1].click();
  assert.equal(eras[1].attributes["aria-pressed"],"true");
  assert.equal(eras[3].attributes["aria-pressed"],"false");
  assert.ok(typeof m.el("interest-btn").listeners.click==="function");
});
test("image files stay local, invalid file is rejected and a valid one enables preview",async()=>{
  const m=mockUI();runInNewContext(js,m.ctxData);
  const file={size:1234,type:"image/png",name:"portrait.png"};
  await m.el("photo").listeners.change({target:{files:[file]}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(m.el("photo-label").textContent,"portrait.png");
  assert.equal(m.el("poster-btn").disabled,false);
  m.el("interest-btn").click();
  assert.match(m.el("status").textContent,/No payment has been taken/);
  assert.equal(m.called.length,0,"Do Not Track keeps analytics disabled");
});
test("aggregate app analytics supports Era Motion with no personal data",()=>{
  assert.match(metrics,/const apps = \[[^\n]*"eramotion"/);
  assert.match(stats,/eramotion:"Era Motion"/);
  assert.match(js,/JSON\.stringify\(\{app:"eramotion",event,source\}\)/);
  assert.match(metrics,/"eramotion"\]\.includes\(app\)/);
  assert.doesNotMatch(js,/JSON\.stringify\(\{.*photo.*\}\)/);
});
