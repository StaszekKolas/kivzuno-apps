"use strict";
// One screen, one action. Runway AI requests are impossible until server flags, secrets
// and owner budget approval are enabled. The default action is FREE format preflight.
(()=>{
 const $=id=>document.getElementById(id);
 const photo=$("photo"),era=$("era"),go=$("go"),consent=$("consent"),form=$("creator");
 const msg=$("message"),banner=$("mode-banner"),label=$("consent-label");
 const preview=$("original"),empty=$("empty"),generated=$("generated-section"),generatedImg=$("generated-image");
 const MAX_FILE=12*1024*1024;
 let dataUri="",busy=false,videoBusy=false,aiEnabled=false,generationVersion=0;
 let ownerKey="",imageJob=null,selectedProduct="photo";
 const motion=$("motion");
 const videoButton=$("video-go"),videoConsent=$("video-consent"),videoMsg=$("video-message");
 function videoMessage(value,kind=""){videoMsg.textContent=value;videoMsg.dataset.kind=kind;}
 function videoState(){
   videoButton.disabled=busy||videoBusy||!aiEnabled||!imageJob||!videoConsent.checked;
   videoButton.textContent=videoBusy?"Creating your 5-second film…":"Create my 5-second film (25 credits)";
 }
 function message(value,kind=""){msg.textContent=value;msg.dataset.kind=kind;}
 function state(){
   go.disabled=busy || videoBusy || !dataUri || !consent.checked ||
     (selectedProduct==="video"&&!aiEnabled);
   videoState();
   go.textContent=busy ? (selectedProduct==="video"?"Creating your AI film…":aiEnabled?"Creating your AI photo…":"Checking your photo…")
     :selectedProduct==="video"?"Create my AI film (25 credits)"
     :aiEnabled?"Create my AI photo (2 credits)":"Check my photo — free";
 }
 function clearResult(){
   imageJob=null;
   generated.hidden=true;generatedImg.hidden=true;generatedImg.removeAttribute("src");
   $("generated-download").hidden=true;
   $("video-section").hidden=true;
   $("generated-video").pause();$("generated-video").removeAttribute("src");$("generated-video").load();
   $("video-download").hidden=true;videoConsent.checked=false;
   videoMessage("Generate an AI image first, then choose to animate it.");
   videoState();
 }
 function mode(enabled){
   aiEnabled=Boolean(enabled);
   if(aiEnabled){
     banner.textContent="PRIVATE OWNER TEST — choose an AI photo OR a film directly from your original photo. No KIVZUNO checkout.";
     label.textContent="I agree to send my photo to KIVZUNO and its AI provider for this transformation.";
     $("action-hint").textContent="Images 2 Runway Dev credits each · No daily KIVZUNO limit";
     $("availability-detail").textContent="Owner preview: AI photos and films are independent. Images use about 2 Runway Dev API credits, films 25. Public payment and watermarked customer previews are NOT enabled.";
   } else {
     banner.textContent="PUBLIC GENERATION DISABLED — Enter your owner test code to unlock AI images and film.";
     label.textContent="I agree to send my photo to KIVZUNO for a free image-format check. It will be discarded; no AI provider is called.";
     $("action-hint").textContent="No login · No credits · No payment";
     $("availability-detail").textContent="Without a private owner code, only the free photo format check works. Images and video are locked for everyone else.";
   }
   consent.checked=false;
   clearResult();
   updateChoice();
 }
 function updateChoice(){
   const movie=selectedProduct==="video";
   $("photo-choice").setAttribute("aria-pressed",String(!movie));
   $("film-choice").setAttribute("aria-pressed",String(movie));
   $("owner-video").hidden=!aiEnabled||movie;
   $("creator-purpose").textContent=movie?"Film AI — directly from your uploaded photo":"Photo AI — transform your uploaded photo";
   if(movie){
     label.textContent="I agree to send my photo to Runway to create one 5-second film using 25 existing API credits.";
     $("action-hint").textContent=aiEnabled
       ?"Runs directly from your photo · 25 existing Runway Dev API credits"
       :"Owner access required for films — unlock with your private code.";
   } else if(aiEnabled){
     label.textContent="I agree to send my photo to KIVZUNO and its AI provider for this transformation.";
     $("action-hint").textContent="Image generation uses 2 existing Runway Dev API credits";
   }else{
     label.textContent="I agree to send my photo to KIVZUNO for a free image-format check. It will be discarded; no AI provider is called.";
     $("action-hint").textContent="No login · No credits · No payment";
   }
   state();
 }
 async function checkMode(){
   try{
     const response=await fetch("/.netlify/functions/era-owner-test",{
       method:"POST",
       headers:{"content-type":"application/json",...(ownerKey?{authorization:"Bearer "+ownerKey}:{})},
       credentials:"same-origin",body:JSON.stringify({action:"capabilities"})
     });
     const body=await response.json();
     mode(response.ok && body.available===true);
     $("owner-state").textContent=aiEnabled
       ?"✓ Owner-only AI test unlocked. No daily limit; 2 credits/image, 25 credits/film."
       :ownerKey?"Owner access is unavailable or not yet configured on the server. No credits used."
       :"Owner-only generation is locked. Nothing is shared or billed.";
   }catch{mode(false);$("owner-state").textContent="Owner generation service unreachable. No credits used.";}
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
     message("Photo ready. Choose an era, tick the box and tap the button.","success");
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
     method:"POST",headers:{"content-type":"application/json",
       ...(path==="era-owner-test"&&ownerKey?{authorization:"Bearer "+ownerKey}:{})},
     credentials:"same-origin",body:JSON.stringify(body)
   });
   const data=await response.json().catch(()=>({error:"invalid_server_response"}));
   if(!response.ok)throw Error(String(data.error||response.status));
   return data;
 }
 async function run(){
   if(busy||!dataUri||!consent.checked)return;
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
     if(selectedProduct==="video"){
       if(!window.confirm("Generate a REAL 5-second film directly from your uploaded photo? This uses approximately 25 existing Runway Dev API credits. No top-up or KIVZUNO payment."))
         return;
       message("Runway is creating a film directly from the original photo. No AI image generation required.");
       const task=await post("era-owner-test",{action:"direct_video_start",photo:img,era:chosen,motion:motion.value,consent:true});
       if(task.status!=="SUBMITTED"||!task.jobId||!task.accessToken)throw Error("Film generation did not start.");
       for(let attempt=0;attempt<90;attempt++){
         await new Promise(resolve=>setTimeout(resolve,5000));
         if(version!==generationVersion||selectedProduct!=="video")throw Error("Photo or generator changed during film creation.");
         const progress=await post("era-owner-test",{
           action:"status",jobId:task.jobId,accessToken:task.accessToken
         });
         if(progress.status==="FAILED"||progress.status==="REVIEW_REQUIRED")
           throw Error("Film could not complete. No automatic retry.");
         if(progress.status==="SUCCEEDED"){
           if(typeof progress.videoUrl!=="string"||!/^https:\/\//.test(progress.videoUrl))
             throw Error("Provider did not return a video.");
           const player=$("generated-video");player.src=progress.videoUrl;player.load();
           $("video-section").hidden=false;
           const link=$("video-download");link.href=progress.videoUrl;link.hidden=false;
           message("A Runway video file was generated. Check that subjects REALLY MOVE and that playback lasts five seconds. This result has not passed motion-quality inspection.","success");
           return;
         }
       }
       throw Error("Film is still processing. No automatic retry was made.");
     }
     message("Sending your photo for one AI transformation. This may take a minute…");
     const task=await post("era-owner-test",{action:"image_start",photo:img,era:chosen,consent:true});
     if(task.status!=="SUBMITTED"||!task.jobId||!task.accessToken)throw Error("Generation did not start.");
     for(let attempt=0;attempt<60;attempt++){
       await new Promise(resolve=>setTimeout(resolve,5000));
       if(version!==generationVersion)throw Error("Photo changed while generating.");
       const status=await post("era-owner-test",{action:"status",jobId:task.jobId,accessToken:task.accessToken});
       if(status.status==="FAILED"||status.status==="REVIEW_REQUIRED")throw Error("Image generation failed. We did not retry or charge again.");
       if(status.status==="SUCCEEDED"){
         if(typeof status.imageUrl!=="string"||!/^https:\/\//.test(status.imageUrl))throw Error("Provider did not supply an image.");
         generatedImg.src=status.imageUrl;
         generatedImg.hidden=false;
         generated.hidden=false;
         const link=$("generated-download");link.href=status.imageUrl;link.hidden=false;
         imageJob={jobId:task.jobId,accessToken:task.accessToken};
         videoMessage("Your AI image is ready. Confirm below to spend 25 Runway Dev credits on a 5-second film.");
         videoState();
         message("✓ Your new AI image is ready. Open or save it below.","success");
         return;
       }
     }
     throw Error("Generation is taking longer than expected. Please do not retry automatically.");
   }catch(err){
     message("Could not complete this step: "+String(err?.message||err).slice(0,130),"error");
   }finally{busy=false;state();}
 }
 async function makeVideo(){
   if(videoBusy||busy||!aiEnabled||!imageJob||!videoConsent.checked)return;
   if(!window.confirm("Generate a real 5-second Runway film? This spends approximately 25 of your existing Runway Dev API credits. No KIVZUNO payment or automatic top-up."))
     return;
   videoBusy=true;state();
   const parent={...imageJob},version=generationVersion;
   $("video-section").hidden=true;videoMessage("Creating your film from the generated AI photo. This uses Runway Dev API credits.");
   try{
     const task=await post("era-owner-test",{
       action:"video_start",imageJobId:parent.jobId,imageAccessToken:parent.accessToken,motion:motion.value,consent:true
     });
     if(task.status!=="SUBMITTED"||!task.jobId||!task.accessToken)throw Error("Video did not start.");
     for(let attempt=0;attempt<90;attempt++){
       await new Promise(resolve=>setTimeout(resolve,5000));
       if(version!==generationVersion || imageJob?.jobId!==parent.jobId)throw Error("Image changed during film creation.");
       const progress=await post("era-owner-test",{
         action:"status",jobId:task.jobId,accessToken:task.accessToken
       });
       if(progress.status==="FAILED"||progress.status==="REVIEW_REQUIRED")throw Error("Video was not completed. No automatic retry.");
       if(progress.status==="SUCCEEDED"){
         if(typeof progress.videoUrl!=="string"||!/^https:\/\//.test(progress.videoUrl))throw Error("Missing video.");
         const player=$("generated-video");player.src=progress.videoUrl;player.load();
         $("video-section").hidden=false;
         const link=$("video-download");link.href=progress.videoUrl;link.hidden=false;
         videoConsent.checked=false;
         videoMessage("A Runway video file was generated. Check motion and duration before deciding whether it is good enough to sell.","success");
         return;
       }
     }
     throw Error("Film is still processing. No new generation was started.");
   }catch(e){videoMessage("Video could not complete: "+String(e.message||e).slice(0,150),"error");}
   finally{videoBusy=false;state();}
 }
 $("owner-unlock").addEventListener("click",async()=>{
   const input=$("owner-key");
   ownerKey=input.value.trim();
   input.value="";
   if(ownerKey.length<32){ownerKey="";$("owner-state").textContent="Enter the private owner test code (at least 32 characters).";return;}
   await checkMode();
   if(!aiEnabled)ownerKey="";
 });
 videoButton.addEventListener("click",makeVideo);
 videoConsent.addEventListener("change",videoState);
 function chooseProduct(next){
   if(busy||videoBusy||!["photo","video"].includes(next)||selectedProduct===next)return;
   selectedProduct=next;
   clearResult();
   consent.checked=false;
   message(dataUri?next==="video"
     ?"Film mode: use your current photo directly — unlock owner access if needed."
     :"Photo mode: transform your current photo.":"Choose a photo to start.");
   updateChoice();
 }
 $("photo-choice").addEventListener("click",()=>chooseProduct("photo"));
 $("film-choice").addEventListener("click",()=>chooseProduct("video"));
 photo.addEventListener("change",()=>onSelect(photo.files?.[0]));
 era.addEventListener("change",()=>{clearResult();message(dataUri?"Era selected. Ready when you are.":"Choose a photo to start.");});
 consent.addEventListener("change",state);
 form.addEventListener("submit",ev=>{ev.preventDefault();run();});
 checkMode();
})();
