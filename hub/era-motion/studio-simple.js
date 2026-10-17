"use strict";
// One screen, one action. Runway AI requests are impossible until server flags, secrets
// and owner budget approval are enabled. The default action is FREE format preflight.
(()=>{
 const $=id=>document.getElementById(id);
 const photo=$("photo"),era=$("era"),go=$("go"),consent=$("consent"),form=$("creator");
 const msg=$("message"),banner=$("mode-banner"),label=$("consent-label");
 const preview=$("original"),empty=$("empty"),generated=$("generated-section"),generatedImg=$("generated-image");
 const MAX_FILE=12*1024*1024;
 let dataUri="",busy=false,aiEnabled=false,generationVersion=0,quotaEligible=false,quotaNotice="";
 function message(value,kind=""){msg.textContent=value;msg.dataset.kind=kind;}
 function resetLabel(resetAt){
   const when=typeof resetAt==="string"?new Date(resetAt):new Date(NaN);
   if(!Number.isFinite(when.getTime()))return "after the next daily reset (00:00 UTC)";
   return new Intl.DateTimeFormat("en-GB",{
     timeZone:"Europe/London",day:"numeric",month:"short",
     hour:"2-digit",minute:"2-digit",hour12:false
   }).format(when)+" UK time";
 }
 function quotaText(reason,resetAt){
   if(reason==="one_image_per_day")return "This browser has used today's free AI photo. Try again from "+resetLabel(resetAt)+".";
   if(reason==="daily_free_image_limit")return "All three shared free AI photos have been used today. New turns open "+resetLabel(resetAt)+".";
   if(reason==="browser_id_unavailable")return "Your browser did not keep the secure KIVZUNO quota cookie. Enable cookies and refresh; no AI credits were used.";
   return "The free AI allowance cannot be checked right now. Please try again later.";
 }
 function lockQuota(reason,resetAt){
   quotaEligible=false;
   quotaNotice=quotaText(reason,resetAt);
   banner.textContent=quotaNotice;
   state();
   return quotaNotice;
 }
 function state(){
   go.disabled=busy || !dataUri || !consent.checked || (aiEnabled&&!quotaEligible);
   go.textContent=busy ? (aiEnabled?"Creating your AI photo…":"Checking your photo…")
     :aiEnabled?(quotaEligible?"Create my AI photo":"AI limit reached — try later"):"Check my photo — free";
 }
 function clearResult(){
   generated.hidden=true;generatedImg.hidden=true;generatedImg.removeAttribute("src");
   $("generated-download").hidden=true;
 }
 function mode(enabled){
   aiEnabled=Boolean(enabled);
   quotaEligible=false;
   quotaNotice="";
   if(aiEnabled){
     banner.textContent="AI BETA · One image per browser each UTC day · Three shared attempts per day across KIVZUNO.";
     label.textContent="I agree to send my photo to KIVZUNO and its AI provider for this transformation.";
     $("action-hint").textContent="No login · A secure first-party cookie tracks this browser's daily allowance";
     $("availability-detail").textContent="One free AI attempt per browser per day; only three free AI attempts are shared by everyone each day. Different devices on one Wi-Fi can each take a turn while shared capacity remains. Paid movies and checkout stay off.";
   } else {
     banner.textContent="PHOTO TEST MODE — Upload works today. Actual AI transformation and video creation are not active yet.";
     label.textContent="I agree to send my photo to KIVZUNO for a free image-format check. It will be discarded; no AI provider is called.";
     $("action-hint").textContent="No login · No credits · No payment";
     $("availability-detail").textContent="Today we can verify your photo reaches KIVZUNO and is accepted. It does not generate an AI transformation or a video. Paid services are off.";
   }
   consent.checked=false;
   state();
 }
 async function checkMode(){
   try{
     const response=await fetch("/.netlify/functions/era-image-task",{
       method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
       body:JSON.stringify({action:"capabilities"})
     });
     const body=await response.json();
     const ready=response.ok && body.available===true;
     mode(ready);
     if(ready)await checkAllowance();
   }catch{mode(false);}
 }
 async function checkAllowance(){
   try{
     const response=await fetch("/.netlify/functions/era-image-task",{
       method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
       body:JSON.stringify({action:"eligibility"})
     });
     const allowance=await response.json();
     if(!response.ok||allowance.eligible!==true){
       lockQuota(allowance.reason||"quota_check_unavailable",allowance.resetAt);
       return;
     }
     quotaEligible=true;
     quotaNotice="";
     state();
   }catch{lockQuota("quota_check_unavailable");}
 }
 async function encode(file){
   if(!file || !["image/jpeg","image/png","image/webp","image/heic","image/heif"].includes(file.type) &&
     !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))throw Error("Choose a JPG, PNG, WebP or iPhone image.");
   if(file.size>MAX_FILE)throw Error("Photo too large. Please choose one under 12 MB.");
   const uri=URL.createObjectURL(file);
   try{
     const img=new Image();
     await new Promise((resolve,reject)=>{
       img.onload=resolve;
       img.onerror=()=>reject(Error("This photo could not be opened. Please choose JPG or PNG."));
       img.src=uri;
       if(img.complete && img.naturalWidth>0)resolve();
     });
     if(!img.naturalWidth||!img.naturalHeight)throw Error("This photo has invalid dimensions.");
     const scale=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight));
     const canvas=document.createElement("canvas");
     canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
     canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
     const ctx=canvas.getContext("2d");
     if(!ctx)throw Error("This browser cannot prepare the photo.");
     ctx.drawImage(img,0,0,canvas.width,canvas.height);
     for(const quality of [.86,.74,.6,.5]){
       const jpeg=canvas.toDataURL("image/jpeg",quality);
       if(jpeg.startsWith("data:image/jpeg;base64,")&&jpeg.length<4_600_000)return jpeg;
     }
     throw Error("This photo is too large to transfer.");
   }finally{URL.revokeObjectURL(uri);}
 }
 async function onSelect(file){
   const version=++generationVersion;
   dataUri="";clearResult();preview.hidden=true;empty.hidden=false;
   consent.checked=false;
   state();
   if(!file){message("Choose a photo to start.");return;}
   message("Opening your photo on this device…");
   try{
     const uri=await encode(file);
     if(version!==generationVersion)return;
     dataUri=uri;
     preview.src=uri;preview.hidden=false;empty.hidden=true;
     $("upload-label").textContent=(file.name||"Your photo").slice(0,65);
     $("preview-tag").textContent="READY";
     message(aiEnabled&&!quotaEligible?(quotaNotice||"AI allowance is currently unavailable."):"Photo ready. Choose an era, tick the box and tap the button.",aiEnabled&&!quotaEligible?"error":"success");
   }catch(err){
     if(version!==generationVersion)return;
     $("upload-label").textContent="Choose a photo";
     $("preview-tag").textContent="LOCAL PREVIEW";
     message(err.message||"Could not open the photo.","error");
   }
   state();
 }
 async function post(path,body){
   const response=await fetch("/.netlify/functions/"+path,{
     method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
     body:JSON.stringify(body)
   });
   const data=await response.json().catch(()=>({error:"invalid_server_response"}));
   if(!response.ok){
     const error=new Error(String(data.error||response.status));
     error.code=data.error;error.resetAt=data.resetAt;
     throw error;
   }
   return data;
 }
 async function run(){
   if(busy||!dataUri||!consent.checked||(aiEnabled&&!quotaEligible))return;
   busy=true;state();clearResult();
   const img=dataUri,chosen=era.value,version=generationVersion;
   try{
     if(!aiEnabled){
       message("Checking photo compatibility…");
       const result=await post("runway-handoff",{action:"preflight",image:img,era:chosen});
       if(result.ready!==true||result.photoTransferred!==true||result.charged!==false)throw Error("Unexpected server response.");
       if(version!==generationVersion)throw Error("Photo changed during the check.");
       message("✓ Your photo passed! KIVZUNO received and validated it. No AI image was generated, no credits used and no payment made.","success");
       return;
     }
     message("Sending your photo for one AI transformation. This may take a minute…");
     const task=await post("era-image-task",{action:"start",photo:img,era:chosen,consent:true});
     if(task.status!=="SUBMITTED"||!task.jobId||!task.accessToken)throw Error("Generation did not start.");
     for(let attempt=0;attempt<30;attempt++){
       await new Promise(resolve=>setTimeout(resolve,10000));
       if(version!==generationVersion)throw Error("Photo changed while generating.");
       const status=await post("era-image-task",{action:"status",jobId:task.jobId,accessToken:task.accessToken});
       if(status.status==="FAILED"||status.status==="REVIEW_REQUIRED")throw Error("Image generation failed. We did not retry or charge again.");
       if(status.status==="SUCCEEDED"){
         if(typeof status.imageUrl!=="string"||!/^https:\/\//.test(status.imageUrl))throw Error("Provider did not supply an image.");
         generatedImg.src=status.imageUrl;
         generatedImg.hidden=false;
         generated.hidden=false;
         const link=$("generated-download");link.href=status.imageUrl;link.hidden=false;
         quotaEligible=false;
         quotaNotice="Your free AI image attempt for today has been used. Please save your result.";
         banner.textContent=quotaNotice;
         message("✓ Your new AI image is ready. Open or save it below.","success");
         return;
       }
     }
     throw Error("Generation is taking longer than expected. Please do not retry automatically.");
   }catch(err){
     if(["one_image_per_day","daily_free_image_limit","browser_id_unavailable"].includes(err?.code)){
       message(lockQuota(err.code,err.resetAt),"error");
     }else{
       message("Could not complete this step: "+String(err?.message||err).slice(0,130),"error");
     }
   }finally{busy=false;state();}
 }
 photo.addEventListener("change",()=>onSelect(photo.files?.[0]));
 era.addEventListener("change",()=>{clearResult();message(dataUri?"Era selected. Ready when you are.":"Choose a photo to start.");});
 consent.addEventListener("change",state);
 form.addEventListener("submit",ev=>{ev.preventDefault();run();});
 checkMode();
})();
