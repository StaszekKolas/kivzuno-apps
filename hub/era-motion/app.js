"use strict";

// KIVZUNO Era Motion v1: free local-photo postcard preview, paid AI films planned.
// No image or image metadata leaves the browser; no claim of generative AI.
const ERAS = [
  {id:"egypt",name:"Ancient Egypt",date:"c. 1300 BCE",icon:"☀️",colors:["#e7a44a","#32131b"],accent:"#f7d37f",motif:"DESERT DYNASTY"},
  {id:"rome",name:"Ancient Rome",date:"c. 100 CE",icon:"🏛️",colors:["#b46c46","#2c1d1b"],accent:"#f5c993",motif:"THE ETERNAL CITY"},
  {id:"viking",name:"Viking Age",date:"c. 900 CE",icon:"🛡️",colors:["#517e95","#0d2837"],accent:"#c1f0f6",motif:"NORTHBOUND"},
  {id:"medieval",name:"Medieval Kingdom",date:"c. 1200",icon:"🏰",colors:["#64486a","#1c1427"],accent:"#f4c873",motif:"A TALE OF LEGENDS"},
  {id:"renaissance",name:"Renaissance",date:"c. 1500",icon:"🎨",colors:["#ab7659","#292127"],accent:"#efdab7",motif:"A NEW GOLDEN AGE"},
  {id:"west",name:"Wild West",date:"c. 1880",icon:"🤠",colors:["#c07940","#43251b"],accent:"#f0c178",motif:"WANTED BY DESTINY"},
  {id:"victorian",name:"Victorian Era",date:"c. 1890",icon:"🎩",colors:["#676c67","#191c23"],accent:"#d9d7bc",motif:"AN ELEGANT AGE"},
  {id:"artdeco",name:"1920s Art Deco",date:"1926",icon:"✨",colors:["#99814e","#0e1c24"],accent:"#ffdb7c",motif:"THE ROARING TWENTIES"},
  {id:"cinema",name:"1940s Cinema",date:"1944",icon:"🎞️",colors:["#96949a","#22212c"],accent:"#f2f1e8",motif:"SILVER SCREEN"},
  {id:"retro",name:"1970s Retro",date:"1977",icon:"🪩",colors:["#d77540","#522339"],accent:"#ffe27c",motif:"GROOVY TIMES"},
  {id:"neon",name:"1980s Neon",date:"1986",icon:"⚡",colors:["#8c409a","#15133d"],accent:"#74ebfa",motif:"ELECTRIC DREAMS"},
  {id:"future",name:"Cyberpunk Future",date:"2088",icon:"🌆",colors:["#375fa5","#150b37"],accent:"#81ffee",motif:"BEYOND TOMORROW"}
];
const $ = id => document.getElementById(id);
const canvas = $("scene");
const ctx = canvas.getContext("2d", {alpha:false});
const MAX_BYTES = 12 * 1024 * 1024;
let chosen = "medieval", photo = null, companion = null, photoUrl = null, companionUrl = null;
let hasStarted = false;
const cleanText = value => String(value || "").replace(/[\r\n]+/g," ").trim().slice(0,45);
const era = () => ERAS.find(e => e.id === chosen) || ERAS[0];
const noTrack = () => navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true;
const sourceParam = new URLSearchParams(location.search).get("src");
const sources = ["ig_reel","ig_story","ig_bio","ig_post","fb_reel","fb_post","tiktok","direct","other"];
const source = sources.includes(sourceParam) ? sourceParam : "direct";
function track(event) {
  if (noTrack() || !["visit","start","complete","premium_click"].includes(event)) return;
  fetch("/.netlify/functions/metrics",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({app:"eramotion",event,source}),
    keepalive:true,
    credentials:"same-origin"
  }).catch(()=>{});
}
function setStatus(message, type) {
  $("status").textContent = message;
  $("status").className = "status" + (type ? " " + type : "");
}
function makeChoices() {
  const grid = $("eras");
  for (const entry of ERAS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "era";
    btn.dataset.era = entry.id;
    btn.setAttribute("aria-pressed", String(entry.id === chosen));
    const sym = document.createElement("span");
    sym.className = "sym";
    sym.textContent = entry.icon;
    const title = document.createElement("span");
    title.className = "name";
    title.textContent = entry.name;
    btn.append(sym,title);
    btn.addEventListener("click",() => {
      chosen = entry.id;
      for (const node of grid.children) node.setAttribute("aria-pressed",String(node === btn));
      drawFrame(.35);
      if (photo) setStatus("Selected: "+entry.name+". Download the free image; AI film is coming later.");
    });
    grid.append(btn);
  }
}
async function loadPhoto(file, kind) {
  if (!file) return;
  if (file.size > MAX_BYTES) { setStatus("Please choose an image smaller than 12 MB.","error"); return; }
  if (!file.type.startsWith("image/")) { setStatus("Please choose an image file.","error"); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise((resolve,reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Browser cannot read this image. Try JPG, PNG or WebP."));
      img.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("Image has no dimensions.");
    // Object URLs are kept only while the image is in browser memory.
    if (kind === "photo") {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photo = img;
      photoUrl = url;
      $("photo-label").textContent = file.name;
    } else {
      if (companionUrl) URL.revokeObjectURL(companionUrl);
      companion = img;
      companionUrl = url;
      $("companion-label").textContent = file.name;
    }
    $("poster-btn").disabled = !photo;
    drawFrame(.35);
    if (kind === "photo" && !hasStarted) {hasStarted = true; track("start");}
    setStatus("Photo ready. Save a free image preview. The AI film product is not live.","success");
  } catch(e) {
    URL.revokeObjectURL(url);
    setStatus(e.message,"error");
  }
}
const W = canvas.width, H = canvas.height;
function roundRect(x,y,w,h,r,fill,stroke) {
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,r);
  if (fill) {ctx.fillStyle=fill;ctx.fill();}
  if (stroke) {ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function text(str,x,y,size,color,weight,align,font) {
  ctx.font=(weight||"800")+" "+size+"px "+(font||"system-ui,-apple-system,sans-serif");
  ctx.textAlign=align||"center";
  ctx.fillStyle=color;
  ctx.fillText(str,x,y);
}
function fittedText(str,x,y,maxWidth,size,color,font) {
  let current=size;
  do {
    ctx.font="900 "+current+"px "+(font||"Georgia,serif");
    if(ctx.measureText(str).width<=maxWidth) break;
    current-=2;
  } while(current>21);
  text(str,x,y,current,color,"900","center",font||"Georgia,serif");
}
function drawImageCover(img,x,y,w,h,zoom) {
  if (!img) return;
  const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight)*(zoom||1);
  const ow=img.naturalWidth*scale, oh=img.naturalHeight*scale;
  ctx.drawImage(img,x+(w-ow)/2,y+(h-oh)/2,ow,oh);
}
function stars(t,accent) {
  ctx.save();
  ctx.globalAlpha=.25;
  for(let i=0;i<35;i++){
    let x=(i*127.37+37)%W, y=(i*239.72+55)%H;
    const delta=Math.sin(t*6.283+i*3)*2;
    ctx.fillStyle=accent;ctx.fillRect(x,y+delta,i%4===0?3:1.4,i%4===0?3:1.4);
  }
  ctx.restore();
}
function motifs(entry,t) {
  ctx.save();
  ctx.globalAlpha=.25;
  ctx.strokeStyle=entry.accent;
  ctx.lineWidth=2;
  const cy=420;
  for (let i=0;i<4;i++){
    const r=280+i*42+Math.sin(t*6.283+i)*9;
    ctx.beginPath();ctx.arc(W/2,cy,r,.05*Math.PI,1.9*Math.PI);ctx.stroke();
  }
  if (["egypt","rome","medieval","renaissance","victorian","artdeco"].includes(entry.id)){
    for(let side of [0,1]) {
      const x=side?W-27:27;
      ctx.strokeRect(x,116,1,620);
      ctx.strokeRect(x+(side?-9:9),135,1,580);
    }
  }
  if (["neon","future","retro"].includes(entry.id)){
    for(let y=590;y<810;y+=21){
      ctx.globalAlpha=.13+(y-590)/180*.1;
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
    }
  }
  ctx.restore();
}
function drawFrame(normalized) {
  const p=Math.max(0,Math.min(1,Number(normalized)||0));
  const e=era();
  const grad=ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,e.colors[0]);grad.addColorStop(.62,e.colors[1]);grad.addColorStop(1,"#06080f");
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  stars(p,e.accent);motifs(e,p);
  // Hero card with a real uploaded photo, gently panning inside an era frame.
  const x=40,y=217,w=460,h=545;
  ctx.save();
  ctx.shadowColor="#000a";ctx.shadowBlur=30;
  roundRect(x-8,y-8,w+16,h+16,20,"#040915");
  ctx.restore();
  ctx.save();
  ctx.beginPath();ctx.roundRect(x,y,w,h,14);ctx.clip();
  if (photo) {
    const scale = 1.06 + p*.11;
    const dx = Math.sin(p*Math.PI*2)*7;
    const dy = (p-.5)*18;
    ctx.translate(dx,dy);
    drawImageCover(photo,x-25,y-25,w+50,h+50,scale);
  } else {
    const dark=ctx.createLinearGradient(x,y,x+w,y+h);dark.addColorStop(0,"#242938");dark.addColorStop(1,"#11131d");
    ctx.fillStyle=dark;ctx.fillRect(x,y,w,h);
    ctx.fillStyle="#ffffff22";ctx.beginPath();ctx.arc(W/2,y+170,75,0,Math.PI*2);ctx.fill();
    roundRect(W/2-137,y+250,274,265,130,"#ffffff1a");
    text("UPLOAD YOUR PHOTO",W/2,y+488,25,"#ffffffbd");
  }
  ctx.restore();
  // Cinematic color treatment, frame and gradients; not AI scene replacement.
  ctx.save();ctx.globalAlpha=.18;
  roundRect(x,y,w,h,14,e.colors[0]);
  ctx.restore();
  const vignette=ctx.createLinearGradient(0,y,0,y+h);
  vignette.addColorStop(0,"#02030aaa");vignette.addColorStop(.19,"#02030a00");vignette.addColorStop(.78,"#02030a10");vignette.addColorStop(1,"#02030add");
  roundRect(x,y,w,h,14,vignette,e.accent);
  ctx.save();ctx.globalAlpha=.85;
  ctx.fillStyle=e.accent;ctx.fillRect(x+13,y+13,80,3);ctx.fillRect(x+13,y+13,3,53);
  ctx.fillRect(x+w-93,y+13,80,3);ctx.fillRect(x+w-16,y+13,3,53);
  ctx.restore();
  // Optional second real photograph in a framed miniature.
  if (companion) {
    ctx.save();
    ctx.beginPath();ctx.arc(413,625,74,0,Math.PI*2);ctx.clip();
    drawImageCover(companion,339,551,148,148,1);
    ctx.restore();
    ctx.strokeStyle=e.accent;ctx.lineWidth=7;ctx.beginPath();ctx.arc(413,625,74,0,Math.PI*2);ctx.stroke();
  }
  text("K I V Z U N O",W/2,74,23,"#ffffff","900");
  text("E R A   M O T I O N",W/2,109,14,e.accent,"800");
  roundRect(128,136,284,35,17,"#0009",e.accent+"aa");
  text(e.date+"   •   PHOTO MOTION",W/2,160,14,"#ffffff","800");
  text(e.motif,W/2,277,15,"#fffefa","900");
  const animal=$("animal").value;
  if (animal) text(animal,464,295,42,"#ffffff");
  fittedText(e.name.toUpperCase(),W/2,812,440,43,e.accent,"Georgia,serif");
  const subtitle=cleanText($("title").value)||"YOUR STORY, REIMAGINED";
  fittedText(subtitle,W/2,852,460,22,"#ffffff","system-ui,sans-serif");
  text("YOUR PHOTO  ·  12 ERAS  ·  ONE STORY",W/2,906,14,"#ffffffce","800");
  ctx.fillStyle=e.accent;ctx.fillRect(135,925,270*p,4);
}
function filename(extension) {
  return "kivzuno-"+chosen+"-"+new Date().toISOString().slice(0,10)+"."+extension;
}
function downloadBlob(blob, name) {
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=name;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function savePoster() {
  if (!photo) return;
  drawFrame(.35);
  canvas.toBlob(blob=>{
    if (!blob) {setStatus("Could not export the still image.","error");return;}
    downloadBlob(blob,filename("png"));
    setStatus("Free PNG postcard ready. AI photo transformation and paid films are not available yet.","success");
    track("complete");
  },"image/png");
}
$("photo").addEventListener("change",e=>loadPhoto(e.target.files[0],"photo"));
$("companion").addEventListener("change",e=>loadPhoto(e.target.files[0],"companion"));
$("animal").addEventListener("change",()=>drawFrame(.35));
$("title").addEventListener("input",()=>drawFrame(.35));
$("poster-btn").addEventListener("click",savePoster);
$("interest-btn").addEventListener("click",()=>{
  track("premium_click");
  setStatus("Thanks! Paid AI films are planned but not available yet. No payment has been taken.","success");
});
window.addEventListener("pagehide",()=>{
  if(photoUrl)URL.revokeObjectURL(photoUrl);
  if(companionUrl)URL.revokeObjectURL(companionUrl);
});
makeChoices();
drawFrame(0);
track("visit");
