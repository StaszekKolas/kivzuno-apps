"use strict";
// One screen, one action. Runway AI requests are impossible until server flags, secrets
// and owner budget approval are enabled. The default action is FREE format preflight.
(()=>{
 const $=id=>document.getElementById(id);
 const photo=$("photo"),era=$("era"),go=$("go"),consent=$("consent"),form=$("creator");
 const msg=$("message"),banner=$("mode-banner"),label=$("consent-label");
 const preview=$("original"),empty=$("empty"),generated=$("generated-section"),generatedImg=$("generated-image");
 const MAX_FILE=12*1024*1024;
 let dataUri="",sourceAspect="portrait",busy=false,aiEnabled=false,generationVersion=0;
 let ownerKey="",selectedProduct="video",ownerBudgetRemaining=null;
 const motion=$("motion");
 function message(value,kind=""){msg.textContent=value;msg.dataset.kind=kind;}
 function state(){
   const required=selectedProduct==="video"?27:2;
   go.disabled=busy || !dataUri || !consent.checked ||
     (selectedProduct==="video"&&!aiEnabled) ||
     (aiEnabled && (!Number.isInteger(ownerBudgetRemaining)||ownerBudgetRemaining<required));
   go.textContent=busy ? (selectedProduct==="video"?"Creating your AI film…":aiEnabled?"Creating your AI photo…":"Checking your photo…")
     :selectedProduct==="video"?"Create my historical film (27 credits)"
     :aiEnabled?"Create my AI photo (2 credits)":"Check my photo — free";
 }
 function clearResult(){
   generated.hidden=true;generatedImg.hidden=true;generatedImg.removeAttribute("src");
   $("generated-download").hidden=true;
   $("video-section").hidden=true;
   $("generated-video").pause();$("generated-video").removeAttribute("src");$("generated-video").load();
   $("video-download").hidden=true;
 }
 function mode(enabled){
   aiEnabled=Boolean(enabled);
   ownerBudgetRemaining=null;
   if(aiEnabled){
     banner.textContent="OWNER TEST — Film AI changes the location and era, then animates the scene. Photo AI remains separate. No customer checkout.";
     label.textContent="I agree to send my photo to KIVZUNO and its AI provider for this transformation.";
     $("action-hint").textContent="Images 2 Runway Dev credits each · No daily KIVZUNO limit";
     $("availability-detail").textContent="Owner preview: Film AI uses an internal historical scene-generation step (2 credits) then animation (25 credits). Total 27 existing Runway Dev API credits. Photo AI remains separate. No public payments or watermarked customer previews.";
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
   $("creator-purpose").textContent=movie?"FILM AI — transform the era and animate it":"PHOTO AI — transform your uploaded photo";
   $("motion-step").hidden=!movie;
   $("active-mode").textContent=movie?"🎬 FILM AI — new historical setting + real motion":"📷 PHOTO AI — create a new image";
   if(movie){
     label.textContent="I agree to create a historical scene and then animate it into a 5-second film, using up to 27 existing Runway Dev API credits.";
     $("action-hint").textContent=aiEnabled
       ?"One tap · two AI stages · 27 existing Runway Dev API credits"
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
     if(aiEnabled){
       // Read the site-wide reservation ledger. Never guess remaining provider credits.
       try{
         const budget=await post("era-owner-test",{action:"budget_status"});
         ownerBudgetRemaining=budget.remaining;
         $("owner-state").textContent="Owner unlocked · Approved test budget: "+
           budget.cap+" · Reserved: "+budget.reserved+" · Available for NEW reservations: "+
           budget.remaining+". This is NOT your Runway credit balance.";
         if(budget.remaining<27){
           message("Safety limit: only "+budget.remaining+
             " of 27 approved test credits remain. Film generation is blocked. "+
             "No Runway call will start. Check Runway Dev Billing and earlier task history before approving more.","error");
         }
       }catch{
         ownerBudgetRemaining=null;
         $("owner-state").textContent="Owner unlocked, but credit reservations cannot be verified. Generation locked for safety.";
       }
       state();
     }else{
       $("owner-state").textContent=ownerKey
         ?"Owner access is unavailable or not configured. No credits used."
         :"Owner-only generation is locked. Nothing is shared or billed.";
     }
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
       if(jpeg.startsWith("data:image/jpeg;base64,")&&jpeg.length<4_600_000)
         return {uri:jpeg,aspect:img.naturalWidth>=img.naturalHeight?"landscape":"portrait"};
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
     const prepared=await encode(file);
     if(version!==generationVersion)return;
     const uri=prepared.uri;sourceAspect=prepared.aspect;
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
       if(!window.confirm("Create ONE 5-second historical film? First Runway transforms the setting to your chosen era (2 credits), then animates it (25 credits). Total 27 existing Runway Dev API credits. Quality is NOT guaranteed. No purchases or auto-top-ups."))
         return;
       message("Stage 1 of 2: Rebuilding your photo into the selected historical era…");
       const task=await post("era-owner-test",{action:"scene_video_start",photo:img,era:chosen,
         aspect:sourceAspect,motion:motion.value,consent:true});
       if(task.status!=="SUBMITTED"||!task.jobId||!task.accessToken)throw Error("Film generation did not start.");
       let priorStage="";
       for(let attempt=0;attempt<120;attempt++){
         await new Promise(resolve=>setTimeout(resolve,5000));
         if(version!==generationVersion||selectedProduct!=="video")throw Error("Photo or generator changed during film creation.");
         const progress=await post("era-owner-test",{
           action:"status",jobId:task.jobId,accessToken:task.accessToken
         });
         if(progress.status==="PROCESSING" && progress.stage!==priorStage){
           priorStage=progress.stage;
           message(priorStage==="MOVIE"
             ?"Stage 2 of 2: The historical setting is ready. Animating people, animals and camera…"
             :"Stage 1 of 2: Rebuilding the entire scene in the chosen era…");
         }
         if(progress.status==="FAILED"||progress.status==="REVIEW_REQUIRED")
           throw Error("Film could not complete. No automatic retry.");
         if(progress.status==="SUCCEEDED"){
           if(typeof progress.videoUrl!=="string"||!/^https:\/\//.test(progress.videoUrl))
             throw Error("Provider did not return a video.");
           const player=$("generated-video");player.src=progress.videoUrl;player.load();
           $("video-section").hidden=false;
           const link=$("video-download");link.href=progress.videoUrl;link.hidden=false;
           message("Your historical film has been generated. Confirm that the era really changed, faces and animals look natural, and the video has genuine motion. This result has NOT been quality-certified.","success");
           return;
         }
       }
       throw Error("Historical film is still processing. No automatic retry was made; avoid a second submission.");
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
         message("✓ Your new AI image is ready. Open or save it below.","success");
         return;
       }
     }
     throw Error("Generation is taking longer than expected. Please do not retry automatically.");
   }catch(err){
     const reason=String(err?.message||err);
     if(reason==="owner_credit_budget_exhausted"){
       ownerBudgetRemaining=0;
       message("KIVZUNO safety limit reached: this test has insufficient reserved credits for another request. "+
         "This does NOT mean your Runway balance is empty. No new Runway job was submitted. "+
         "Check Runway Dev Billing and stop retrying until the limit is reviewed.","error");
     }else{
       message("Could not complete this step: "+reason.slice(0,130),"error");
     }
   }finally{busy=false;state();}
 }
 $("owner-unlock").addEventListener("click",async()=>{
   const input=$("owner-key");
   ownerKey=input.value.trim();
   input.value="";
   if(ownerKey.length<32){ownerKey="";$("owner-state").textContent="Enter the private owner test code (at least 32 characters).";return;}
   await checkMode();
   if(!aiEnabled)ownerKey="";
 });
 function chooseProduct(next){
   if(busy||!["photo","video"].includes(next)||selectedProduct===next)return;
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
