"use strict";
// KIVZUNO Era Motion: genuine photo-to-photo AI via Puter.js.
// All AI calls are user initiated after explicit disclosure/consent.
const ERAS = [
 {id:"egypt", name:"Ancient Egypt", icon:"☀️", scene:"ancient Egypt in the time of the pharaohs, royal linen and gold, grand temples and golden desert, historically inspired"},
 {id:"rome", name:"Ancient Rome", icon:"🏛️", scene:"imperial Rome, authentic Roman costume, Forum Romanum, monumental columns, afternoon sun"},
 {id:"viking", name:"Viking Age", icon:"🛡️", scene:"Viking Age Scandinavia, authentic northern garments, dramatic fjord and wooden longhouses"},
 {id:"medieval", name:"Medieval Kingdom", icon:"🏰", scene:"a medieval European kingdom, richly detailed 13th-century clothing, stone castle and sweeping landscapes"},
 {id:"renaissance", name:"Renaissance", icon:"🎨", scene:"Italian Renaissance, elegant 16th-century fashion, palazzo architecture, exquisite painterly cinematic lighting"},
 {id:"west", name:"Wild West", icon:"🤠", scene:"American frontier Wild West in the late 1800s, authentic western costume, dusty frontier town and cinematic sunset"},
 {id:"victorian", name:"Victorian Era", icon:"🎩", scene:"Victorian London in 1890, era-accurate elegant clothes, historic gas-lit cobbled streets"},
 {id:"artdeco", name:"1920s Art Deco", icon:"✨", scene:"glamorous Roaring Twenties in 1926, Art Deco architecture, stylish period dress, grand jazz-age ambience"},
 {id:"cinema", name:"1940s Cinema", icon:"🎞️", scene:"1940s classic black-and-white Hollywood film, authentic period costume, cinematic noir lighting"},
 {id:"retro", name:"1970s Retro", icon:"🪩", scene:"1970s vintage street photography, authentic seventies fashion, warm analog colors and retro architecture"},
 {id:"neon", name:"1980s Neon", icon:"⚡", scene:"1980s neon city with analog film aesthetic, authentic eighties outfit and electric atmosphere"},
 {id:"future", name:"Cyberpunk Future", icon:"🌆", scene:"a believable futuristic cyberpunk city in 2088, imaginative future clothing, cinematic neon skyline"}
];
const $ = id => document.getElementById(id);
const MAX_BYTES = 12 * 1024 * 1024;
const selected = {photo:null, companion:null};
let chosen = "medieval", generating = false, generatingVideo = false, generatedSrc = "", generatedVideoSrc = "";
const sourceParam = new URLSearchParams(location.search).get("src");
const allowedSources = ["ig_reel","ig_story","ig_bio","ig_post","fb_reel","fb_post","tiktok","direct","other"];
const source = allowedSources.includes(sourceParam) ? sourceParam : "direct";
const noTrack = () => navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true;
function track(event) {
  if (noTrack() || !["visit","start","complete","premium_click"].includes(event)) return;
  fetch("/.netlify/functions/metrics", {
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({app:"eramotion",event,source}),
    credentials:"same-origin",keepalive:true
  }).catch(()=>{});
}
function status(message,kind="") {
  $("status").textContent=message;
  $("status").className="status"+(kind?" "+kind:"");
}
function refreshButtons() {
  $("generate-btn").disabled=generating || generatingVideo || !selected.photo || !$("consent").checked;
  $("download-btn").disabled=!generatedSrc || generating || generatingVideo;
  $("video-btn").disabled=generating || generatingVideo || !generatedSrc || !$("video-consent").checked;
  $("video-download").hidden=!generatedVideoSrc;
  $("video-btn").textContent=generatingVideo?"Creating your real AI film…":"🎬 Animate this photo (6 seconds)";
}
function resetVideo() {
  generatedVideoSrc="";
  $("generated-video").pause?.();
  $("generated-video").removeAttribute("src");
  $("generated-video").load?.();
  $("generated-video").hidden=true;
  $("video-download").hidden=true;
  $("video-consent").checked=false;
}
function resetResult() {
  resetVideo();
  generatedSrc="";
  $("generated").hidden=true;
  $("generated").removeAttribute("src");
  $("output-placeholder").hidden=false;
  refreshButtons();
}
function makeChoices() {
  const grid=$("eras");
  for(const entry of ERAS) {
    const button=document.createElement("button");
    button.type="button";button.className="era";
    button.dataset.era=entry.id;
    button.setAttribute("aria-pressed",String(entry.id===chosen));
    const sym=document.createElement("span");sym.className="sym";sym.textContent=entry.icon;
    const name=document.createElement("span");name.className="name";name.textContent=entry.name;
    button.append(sym,name);
    button.addEventListener("click",()=>{
      if(generating || generatingVideo)return;
      chosen=entry.id;
      for(const node of grid.children)node.setAttribute("aria-pressed",String(node===button));
      resetResult();
      status("Selected "+entry.name+". Ready for a real AI transformation.");
    });
    grid.append(button);
  }
}
async function encodeImage(file) {
  if (!file || !file.type.startsWith("image/"))throw new Error("Please choose a photo.");
  if(file.size>MAX_BYTES)throw new Error("Image too large. Choose a photo under 12 MB.");
  const url=URL.createObjectURL(file);
  const img=new Image();
  try {
    await new Promise((resolve,reject)=>{
      img.onload=resolve;
      img.onerror=()=>reject(new Error("Could not open this image. Try a JPG or PNG."));
      img.src=url;
    });
    if(!img.naturalWidth||!img.naturalHeight)throw new Error("Image has no dimensions.");
    // Resize and re-encode locally; strips EXIF and shrinks phone uploads.
    const scale=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight));
    const w=Math.max(1,Math.round(img.naturalWidth*scale));
    const h=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Photo processing is not supported in this browser.");
    ctx.drawImage(img,0,0,w,h);
    return canvas.toDataURL("image/jpeg",.87);
  } finally {URL.revokeObjectURL(url);}
}
async function onPhoto(file,kind) {
  if(!file)return;
  if(generating || generatingVideo)return;
  try {
    status("Preparing your photo on this device…");
    const data=await encodeImage(file);
    selected[kind]=data;
    $(kind==="photo"?"photo-label":"companion-label").textContent=file.name.slice(0,85);
    if(kind==="photo") {
      $("before").src=data;$("before").hidden=false;$("before-placeholder").hidden=true;
    }
    resetResult();
    $("consent").checked=false;
    status("Photo ready. Select an era and tick the consent box.","success");
  } catch(e) {status(e.message || "Unable to open photo.","error");}
  refreshButtons();
}
function generatePrompt() {
  const entry=ERAS.find(e=>e.id===chosen);
  const extra=$("animal").value;
  const note=$("title").value.trim().slice(0,45);
  return [
    "IMAGE EDITING TASK: Use uploaded image 1 as the PRIMARY identity reference.",
    selected.companion?"Use uploaded image 2 as SECOND subject reference. Both subjects must appear naturally in the SAME NEW SCENE, interacting realistically.":"Use the original subject as the main protagonist.",
    "Create a newly rendered, photorealistic cinematic photograph set in "+entry.scene+".",
    "IMPORTANT: Truly change the location, clothing/outfit, lighting and atmosphere to fit that era. DO NOT frame, caption, crop or collage the original photograph. Do not keep the original outdoor background; regenerate the ENTIRE environment.",
    "Maintain recognizable facial features, proportions, individual animal appearance and fur coloration as much as feasible. Depict everyone respectfully.",
    extra?"Include a realistic "+extra+" as a natural part of the historical/fantasy scene (avoid duplicating any uploaded animal).":"",
    note?"Additional artistic direction: "+note+".":"",
    "One cohesive original image, natural poses, professionally cinematic composition, fine photorealistic details. No captions, text, typography, watermarks, split screen, borders, frames or extra limbs."
  ].filter(Boolean).join(" ");
}
function humanError(error) {
  const code=String(error?.errorCode || error?.code || "");
  const msg=String(error?.message || error?.msg || error || "");
  if (/model not found|unknown model|model_not_found/i.test(code+" "+msg))return "This Puter AI model is unavailable right now. No image was generated. Please share this error with KIVZUNO.";
  if (/insufficient_funds|subscription_required/i.test(code+" "+msg))return "Your Puter allowance is insufficient. KIVZUNO has not taken any payment. Do not buy credits unless you decide to.";
  if (/auth_window_closed|popup_blocked|unsupported_origin/i.test(code+" "+msg))return "Puter sign-in did not finish. Open KIVZUNO in Safari (not Facebook's built-in browser) and allow the login popup.";
  if (/moderation_flagged|content policy|safety/i.test(code+" "+msg))return "The model refused this edit. Try a different photograph or artistic description.";
  return "AI could not generate the image: "+msg.slice(0,160)+". No result was created.";
}
async function generate() {
  if(generating || !selected.photo || !$("consent").checked)return;
  if(!window.puter || typeof window.puter.ai?.txt2img!=="function") {
    status("Puter AI did not load. Try Safari or refresh the page.","error");return;
  }
  generating=true;resetResult();refreshButtons();
  try {
    // Sign-in is initiated directly by a real button click, as required for popup blockers.
    status("Opening Puter sign-in (your personal free allowance may apply)…");
    await window.puter.auth.signIn();
    status("Sending consented photo(s) to Puter for AI transformation. This may take up to a minute…");
    track("start");
    const referenceImages=[selected.photo];
    if(selected.companion)referenceImages.push(selected.companion);
    const image=await window.puter.ai.txt2img(generatePrompt(),{
      model:"gpt-image-2",
      quality:"medium",
      ratio:{w:3,h:4},
      input_images:referenceImages
    });
    if(!image || typeof image.src!=="string" || !/^(data:image\/|https:\/\/|blob:)/i.test(image.src))throw new Error("Provider returned no usable image.");
    generatedSrc=image.src;
    const rendered=$("generated");
    await new Promise((resolve,reject)=>{
      rendered.onload=resolve;
      rendered.onerror=()=>reject(new Error("Generated image could not be displayed."));
      rendered.src=generatedSrc;
      if(rendered.complete && rendered.naturalWidth>0)resolve();
    });
    $("output-placeholder").hidden=true;
    rendered.hidden=false;
    track("complete");
    status("Real AI image ready! Download it below.","success");
  } catch(e) {resetResult();status(humanError(e),"error");}
  finally {generating=false;refreshButtons();}
}
async function downloadResult() {
  if(!generatedSrc)return;
  const ext="png";
  const name="kivzuno-ai-"+chosen+"-"+new Date().toISOString().slice(0,10)+"."+ext;
  try {
    const response=await fetch(generatedSrc,{mode:"cors"});
    if(!response.ok)throw new Error("Image cannot be downloaded.");
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=name;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    status("AI image saved to your downloads.","success");
  }catch(e){
    // Some providers restrict cross-origin blob fetches.
    window.open(generatedSrc,"_blank","noopener,noreferrer");
    status("Opened the generated image in a new tab — use Save Image in your browser.","success");
  }
}

function videoPrompt() {
  const entry=ERAS.find(e=>e.id===chosen);
  return [
    "Animate the exact photograph supplied as the first video frame.",
    "Create a six-second cinematic scene set in "+entry.scene+".",
    "The camera slowly moves forward, with convincing natural motion, ambient light and realistic details.",
    "Keep the subject's face, animal markings, clothing and appearance consistent with the reference image.",
    "No morphing faces, no new subjects or limbs, no words, no logos, no subtitles.",
    "Cinematic photorealism; natural subtle movement and film-quality continuity."
  ].join(" ");
}
async function generateVideo() {
  if (generating || generatingVideo || !generatedSrc || !$("video-consent").checked)return;
  if(!window.puter || typeof window.puter.ai?.txt2vid!=="function"){
    status("The Puter image-to-video service is not available. Open in Safari and refresh.","error");return;
  }
  // Explicit second user action before a credit-consuming request.
  if (!window.confirm("REAL AI FILM: Puter may deduct your own AI credits or use your remaining allowance. KIVZUNO does not charge you or receive payment. Proceed with a 6-second film?"))return;
  generatingVideo=true;
  resetVideo();
  $("video-consent").checked=true; // retain the separately confirmed explicit consent
  refreshButtons();
  try{
    status("Puter is creating your real 6-second film. This may take several minutes; keep this page open.");
    await window.puter.auth.signIn();
    const clip=await window.puter.ai.txt2vid(videoPrompt(),{
      model:"togetherai:google/veo-3.1-lite",
      seconds:6,
      input_reference:generatedSrc
    });
    const src=typeof clip?.src==="string" && clip.src ? clip.src
      : typeof clip?.currentSrc==="string" && clip.currentSrc ? clip.currentSrc
      : typeof clip?.querySelector==="function" ? clip.querySelector("source")?.src : "";
    if (!src || !/^(https:\/\/|blob:|data:video\/)/i.test(src))
      throw new Error("Puter returned a video without a playable source.");
    generatedVideoSrc=src;
    const player=$("generated-video");
    player.src=src;
    player.controls=true;
    player.playsInline=true;
    player.hidden=false;
    player.load?.();
    const link=$("video-download");
    link.href=src;
    link.hidden=false;
    status("Your real AI video is ready. Play it below or open/save the clip.","success");
  }catch(e){
    resetVideo();
    status("Video generation failed: "+humanError(e),"error");
  }finally{
    generatingVideo=false;refreshButtons();
  }
}
$("photo").addEventListener("change",e=>onPhoto(e.target.files[0],"photo"));
$("companion").addEventListener("change",e=>onPhoto(e.target.files[0],"companion"));
$("animal").addEventListener("change",resetResult);
$("title").addEventListener("input",resetResult);
$("consent").addEventListener("change",refreshButtons);
$("video-consent").addEventListener("change",refreshButtons);
$("generate-btn").addEventListener("click",generate);
$("download-btn").addEventListener("click",downloadResult);
$("video-btn").addEventListener("click",generateVideo);
$("interest-btn").addEventListener("click",()=>{
  track("premium_click");
  status("Thanks! Real AI videos are not for sale yet; no money has been taken.","success");
});
makeChoices();refreshButtons();track("visit");
