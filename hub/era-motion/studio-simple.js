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
 let currentScene=null,sceneLookupReady=false,sceneImageValid=false;
 const motion=$("motion"),look=$("look");
 function message(value,kind=""){msg.textContent=value;msg.dataset.kind=kind;}
 function blockReason(){
   if(!dataUri)return "Select a photo to begin.";
   if(!consent.checked)return "Tick the consent checkbox above.";
   if(selectedProduct==="video"&&!aiEnabled)
     return "Film AI needs owner access. Unlock the test at the top of this page.";
   if(aiEnabled&&!Number.isInteger(ownerBudgetRemaining))
     return "Owner access is open but the remaining test budget could not be checked. No credits will be spent. Ask for a budget diagnostic.";
   if(selectedProduct==="video"&&!sceneLookupReady)
     return "Checking whether your previously approved historical scene can be reused. This lookup is free.";
   const required=selectedProduct==="video"&&currentScene?.approved?25:2;
   if(aiEnabled&&ownerBudgetRemaining<required)
     return "KIVZUNO's approved test budget has only "+ownerBudgetRemaining+
       " reservation credits left; this step needs "+required+
       ". The Runway Dev balance is separate. No generation was submitted.";
   return "";
 }
 function state(){
   // An in-flight operation cannot be silently switched to a different era,
   // source photo or style during generation.
   photo.disabled=busy;era.disabled=busy;look.disabled=busy;motion.disabled=busy;
   $("photo-choice").disabled=busy;$("film-choice").disabled=busy;
   // Do not make a locked budget look like a broken button: clicking shows the
   // blocking reason but never calls the paid provider if a prerequisite fails.
   go.disabled=busy||!dataUri||(selectedProduct==="video"&&!!currentScene&&!currentScene.approved);
   const reason=blockReason();
   const diag=$("generation-diagnostic");
   diag.textContent=busy?"Generation in progress…":
     selectedProduct==="video"&&currentScene&&!currentScene.approved
       ?"Your picture is ready. Check it below and click Approve for Film before spending another 25 credits."
       :reason||"Ready: confirm once before spending credits on this step.";
   diag.dataset.kind=reason?"warning":"success";
   go.textContent=busy ? (selectedProduct==="video"&&currentScene?.approved?"Creating your film…":"Preparing historical scene…")
     :!dataUri?"Choose a photo first"
     :selectedProduct==="video"
       ?(currentScene?.approved?"Generate 5-second film (25 credits)"
         :currentScene?"Approve the scene below first":"Prepare historical scene (2 credits)")
       :aiEnabled?"Create my AI photo (2 credits)":"Check my photo — free";
 }
 function clearResult(){
   generated.hidden=true;generatedImg.hidden=true;generatedImg.removeAttribute("src");
   $("generated-download").hidden=true;
   $("video-section").hidden=true;
   $("generated-video").pause();$("generated-video").removeAttribute("src");$("generated-video").load();
   $("video-download").hidden=true;
   $("scene-review").hidden=true;
   $("approve-scene").disabled=true;
   $("image-quality").textContent="Check the people, animals, historical objects and composition before approving.";
   $("approval-state").textContent="Needs your review. No video will start automatically.";
   $("video-quality").textContent="Video file needs a manual review of motion, appearance and era accuracy.";
 }
 function mode(enabled){
   aiEnabled=Boolean(enabled);
   ownerBudgetRemaining=null;
   $("credit-audit").hidden=!aiEnabled;
   $("audit-report").textContent="No audit requested yet.";
   if(aiEnabled){
     banner.textContent="OWNER TEST — Film AI changes the location and era, then animates the scene. Photo AI remains separate. No customer checkout.";
     label.textContent="I agree to send my photo to KIVZUNO and its AI provider for this transformation.";
     $("action-hint").textContent="Images 2 Runway Dev credits each · No daily KIVZUNO limit";
     $("availability-detail").textContent="Owner preview: Film AI prepares one 2-credit scene and STOPS for your approval before any 25-credit animation. Photo AI is separate. Approved scenes can be reused at no image-generation cost. No public payments, ads or customer previews.";
   } else {
     banner.textContent="PUBLIC GENERATION DISABLED — Enter your owner test code to unlock AI images and film.";
     label.textContent="I agree to send my photo to KIVZUNO for a free image-format check. It will be discarded; no AI provider is called.";
     $("action-hint").textContent="No login · No credits · No payment";
     $("availability-detail").textContent="Without a private owner code, only the free photo format check works. Images and video are locked for everyone else.";
   }
   consent.checked=false;
   clearResult();
   currentScene=null;sceneImageValid=false;sceneLookupReady=false;
   updateChoice();
   if(aiEnabled&&dataUri&&selectedProduct==="video")lookupScene();
 }
 function updateChoice(){
   const movie=selectedProduct==="video";
   $("photo-choice").setAttribute("aria-pressed",String(!movie));
   $("film-choice").setAttribute("aria-pressed",String(movie));
   $("creator-purpose").textContent=movie?"FILM AI — transform the era and animate it":"PHOTO AI — transform your uploaded photo";
   // Both photos and videos need action; a still captures a mid-action moment.
   $("motion-step").hidden=false;
   $("motion-title").textContent=movie?"How should the scene move?":"What should happen in your picture?";
   $("motion-help").textContent=movie
     ?"Make subjects perform real actions instead of moving a frozen photo."
     :"Capture an exciting split-second of action without losing the original people, pets or camera angle.";
   $("active-mode").textContent=movie?"🎬 FILM AI — approve the historical scene before animating"
     :"📷 PHOTO AI — your original scene becomes an action shot";
   if(movie){
     label.textContent="I agree to submit only the current step to Runway. Preparing a scene uses 2 existing credits; a separately approved film uses 25.";
     $("action-hint").textContent=aiEnabled
       ?"Scene preparation: 2 credits · Approval: free · Film: 25 credits"
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
         if(!Number.isSafeInteger(budget.remaining)||!Number.isSafeInteger(budget.cap)||
            !Number.isSafeInteger(budget.reserved)||budget.remaining<0||
            budget.remaining>budget.cap)throw Error("invalid_budget");
         ownerBudgetRemaining=budget.remaining;
         $("owner-state").textContent="Owner unlocked · Private test cap: "+
           budget.cap+" ("+budget.originalBudget+" original + "+
           budget.additionalApproved+" additionally approved) · Reserved: "+
           budget.reserved+" · Available for NEW reservations: "+
           budget.remaining+". This is NOT your Runway Dev balance.";
         if(budget.remaining<27){
           message("Remaining KIVZUNO test reservation budget: "+budget.remaining+
             ". A film needs 27, a photo needs 2. If you cannot generate, the limit is stopping a Runway call—not the button. "+
             "Compare Runway Dev billing and past tasks before authorizing any more credits.","error");
         }
       }catch{
         ownerBudgetRemaining=null;
         $("owner-state").textContent="Owner unlocked, but the test budget lookup failed. This is a diagnostic problem; generation stays safely locked.";
         message("Cannot read KIVZUNO budget status. Please send this message for diagnosis. No credits were spent.","error");
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
   dataUri="";currentScene=null;sceneLookupReady=false;sceneImageValid=false;
   clearResult();preview.hidden=true;empty.hidden=false;
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
   if(aiEnabled&&dataUri&&selectedProduct==="video")await lookupScene();
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
 async function refreshBudget(){
   if(!aiEnabled)return;
   try{
     const v=await post("era-owner-test",{action:"budget_status"});
     ownerBudgetRemaining=Number.isSafeInteger(v.remaining)?v.remaining:null;
   }catch{ownerBudgetRemaining=null;}
   state();
 }
 const approvalChecks=["check-subjects","check-history","check-action"];
 function updateApproval(){
   $("approve-scene").disabled=busy||!sceneImageValid||!currentScene||
     currentScene.approved||(!currentScene.accessToken&&!currentScene.restored)||
     !approvalChecks.every(id=>$(id).checked);
 }
 approvalChecks.forEach(id=>$(id).addEventListener("change",updateApproval));
 function showScene(scene){
   currentScene=scene;sceneImageValid=false;sceneLookupReady=true;
   approvalChecks.forEach(id=>{$(id).checked=false;$(id).disabled=!!scene.approved;});
   generated.hidden=false;generatedImg.hidden=false;
   $("scene-review").hidden=false;
   $("approve-scene").disabled=true;
   $("approval-state").textContent=scene.approved
     ?"Approved for this photograph, era and style. No new image needed."
     :"Needs your approval. No video has started.";
   generatedImg.onload=()=>{
     const wide=generatedImg.naturalWidth>=generatedImg.naturalHeight;
     const good=wide===(sourceAspect==="landscape");
     sceneImageValid=good;
     $("image-quality").textContent=good
       ?"Format check passed. VISUALLY inspect identity, count, era accuracy, no modern objects and action. Automatic visual checks are not available."
       :"WRONG IMAGE ORIENTATION — do not approve this scene. Needs Review.";
     updateApproval();
     state();
   };
   generatedImg.onerror=()=>{
     sceneImageValid=false;$("image-quality").textContent=
       "Preview image could not load or provider link expired. No paid retry will happen.";
     $("approve-scene").disabled=true;
   };
   generatedImg.src=scene.imageUrl;
   const link=$("generated-download");link.href=scene.imageUrl;link.hidden=false;
   state();
 }
 async function lookupScene(){
   if(!aiEnabled||!dataUri||selectedProduct!=="video")return;
   const version=generationVersion,chosen=era.value,style=look.value,action=motion.value;
   if(currentScene){sceneLookupReady=true;showScene(currentScene);return;}
   sceneLookupReady=false;state();
   try{
     const info=await post("era-owner-test",{action:"scene_lookup",
       photo:dataUri,era:chosen,look:style,motion:action,aspect:sourceAspect});
     if(version!==generationVersion||chosen!==era.value||style!==look.value||
        action!==motion.value||selectedProduct!=="video")return;
     sceneLookupReady=true;
     if(info.status==="ALREADY_APPROVED"&&/^https:\/\//.test(info.imageUrl)){
       showScene({approved:true,imageUrl:info.imageUrl,jobId:info.jobId});
       message("Found your earlier approved scene. No image credits spent.","success");
     }else if(info.status==="PREPARED_NEEDS_REVIEW"&&/^https:\/\//.test(info.imageUrl)){
       showScene({approved:false,restored:true,imageUrl:info.imageUrl,jobId:info.jobId});
       message("Restored the scene from your previous session. Review it without paying another 2 credits.","success");
     }else if(info.status==="PROCESSING"){
       sceneLookupReady=false;
       message("A previous image generation is still processing. Checking again automatically without submitting a new paid job.");
       state();
       setTimeout(()=>{
         if(version===generationVersion&&selectedProduct==="video"&&
           style===look.value&&action===motion.value&&chosen===era.value)lookupScene();
       },5000);
     }else if(info.status==="REVIEW_REQUIRED"){
       sceneLookupReady=false;state();
       message("An earlier image request requires review. No duplicate paid request will be started. Check the Runway task before trying again.","error");
     }else{
       state();
       message("No prepared scene found. Generate ONE image for 2 credits, review it, then decide about a film.");
     }
   }catch(e){
     if(version!==generationVersion)return;
     sceneLookupReady=false;
     message("Cannot check previously approved scenes. No generation is permitted until lookup works: "+String(e.message),"error");
     state();
   }
 }
 async function pollJob(task,version){
   for(let attempt=0;attempt<90;attempt++){
     await new Promise(resolve=>setTimeout(resolve,5000));
     if(version!==generationVersion)throw Error("Photo changed. No automatic retry.");
     const update=await post("era-owner-test",{
       action:"status",jobId:task.jobId,accessToken:task.accessToken});
     if(update.status==="FAILED"||
       (update.status==="REVIEW_REQUIRED"&&!update.videoUrl))
       throw Error("Provider task requires review or failed. No automatic retry.");
     if(update.status==="SUCCEEDED"||update.videoUrl)return update;
   }
   throw Error("Provider processing timeout. Do NOT start a duplicate paid task.");
 }
 async function run(){
   if(busy||!dataUri)return;
   const reason=blockReason();
   if(reason){message(reason,"error");state();return;}
   if(selectedProduct==="video"&&currentScene&&!currentScene.approved){
     message("First review and approve the scene below, free of charge.","error");return;
   }
   busy=true;state();
   const img=dataUri,chosen=era.value,version=generationVersion,style=look.value,action=motion.value;
   try{
     if(!aiEnabled){
       message("Checking photo compatibility…");
       const result=await post("runway-handoff",{action:"preflight",image:img,era:chosen});
       if(result.ready!==true||result.photoTransferred!==true||result.charged!==false)
         throw Error("Unexpected validation response.");
       message("Photo compatibility confirmed. No AI credits used.","success");
       return;
     }
     if(selectedProduct==="video"&&currentScene?.approved){
       if(!sceneImageValid)throw Error("Scene preview has not passed orientation check.");
       if(!window.confirm("Spend exactly 25 existing Runway Dev API credits for ONE 5-second film from the APPROVED scene? This is a separate task, with no retry, no top-up and no automatic purchase."))
         return;
       message("Starting only the 25-credit animation of your approved scene…");
       const task=await post("era-owner-test",{action:"film_start",photo:img,era:chosen,
         aspect:sourceAspect,motion:action,look:style,consent:true});
       await refreshBudget();
       const final=await pollJob(task,version);
       if(!final.videoUrl)throw Error("No video file returned. Check job history.");
       const player=$("generated-video");
       player.onloadedmetadata=()=>{
         const d=player.duration,valid=Number.isFinite(d)&&Math.abs(d-5)<=0.8;
         $("video-quality").textContent=valid
           ?"Duration check: ~5 seconds. NEEDS REVIEW: watch for real subject movement, stable faces, exact animal count and correct era."
           :"NEEDS REVIEW: clip duration is not approximately 5 seconds. Do not sell this output.";
       };
       player.src=final.videoUrl;player.load();
       $("video-section").hidden=false;
       const link=$("video-download");link.href=final.videoUrl;link.hidden=false;
       message("Film file delivered — NEEDS REVIEW. Check movement, scene continuity and faces. Do not assume API success means good motion.","success");
       return;
     }
     if(!window.confirm("Generate ONE historical "+(selectedProduct==="video"?"scene for review":"AI photo")+
       " for 2 existing Runway Dev API credits? No automatic retries or video will follow."))
       return;
     clearResult();
     currentScene=null;sceneImageValid=false;
     message("Generating only the historical image. It will NOT start video automatically…");
     const task=await post("era-owner-test",{
       action:selectedProduct==="video"?"scene_prepare":"image_start",
       photo:img,era:chosen,aspect:sourceAspect,motion:action,look:style,consent:true
     });
     if(task.status==="ALREADY_APPROVED"){
       showScene({approved:true,imageUrl:task.imageUrl,jobId:task.jobId});
       message("Reused previously approved scene for free. No image credits spent.","success");return;
     }
     if(task.status==="PREPARED_NEEDS_REVIEW"&&/^https:\/\//.test(task.imageUrl)){
       showScene({approved:false,restored:true,imageUrl:task.imageUrl,jobId:task.jobId});
       message("Restored a previously generated scene without charging another 2 credits.","success");return;
     }
     if(task.status==="PROCESSING"||task.status==="REVIEW_REQUIRED"){
       sceneLookupReady=false;
       message("An earlier image request is still processing or needs review. No duplicate generation started.","error");
       return;
     }
     if(task.status!=="SUBMITTED"||!task.jobId||!task.accessToken)
       throw Error("Image task not submitted.");
     await refreshBudget();
     const result=await pollJob(task,version);
     if(!result.imageUrl)throw Error("Provider returned no image.");
     showScene({approved:false,jobId:task.jobId,accessToken:task.accessToken,
       imageUrl:result.imageUrl});
     message("Scene created — NEEDS REVIEW. Check subjects, history and composition; approve only if satisfied.","success");
   }catch(e){
     const reason=String(e?.message||e);
     message("Could not complete this step: "+reason.slice(0,180)+". No automatic retry.","error");
   }finally{busy=false;state();updateApproval();}
 }
 $("approve-scene").addEventListener("click",async()=>{
   if(!aiEnabled||!currentScene||currentScene.approved||!sceneImageValid||
      (!currentScene.accessToken&&!currentScene.restored)||busy||
      !approvalChecks.every(id=>$(id).checked))return;
   if(!window.confirm("Approve this historical picture for your Film AI? Approval costs ZERO credits. Film generation will still need a separate 25-credit confirmation."))return;
   busy=true;state();
   try{
     const result=await post("era-owner-test",{action:"scene_approve",
       jobId:currentScene.jobId,accessToken:currentScene.accessToken,
       photo:dataUri,era:era.value,aspect:sourceAspect,
       motion:motion.value,look:look.value});
     if(result.status!=="ALREADY_APPROVED")throw Error("Scene approval was not confirmed.");
     currentScene={...currentScene,approved:true};
     $("approve-scene").disabled=true;
     $("approval-state").textContent="Approved. You may now generate the film using 25 credits, or return later and reuse this scene.";
     message("Scene approved for film. NO video credits were spent by this approval.","success");
   }catch(e){message("Could not approve the scene: "+String(e.message),"error");}
   finally{busy=false;state();updateApproval();}
 });
 $("audit-button").addEventListener("click",async()=>{
   const button=$("audit-button"),display=$("audit-report");
   if(!aiEnabled||!ownerKey){
     display.textContent="Audit unavailable: unlock owner access first.";
     return;
   }
   button.disabled=true;
   display.textContent="Reading historical reservations (no Runway calls)…";
   try{
     const audit=await post("era-owner-test",{action:"audit_reservations"});
     const safe=n=>Number.isSafeInteger(n)?String(n):"unknown";
     const group=(title,value)=>title+": "+safe(value?.credits)+" reserved credits / "+safe(value?.jobs)+" jobs";
     display.textContent=[
       "KIVZUNO READ-ONLY AUDIT",
       "Approved budget: "+safe(audit.cap),
       "Reserved: "+safe(audit.reservedCredits),
       "Still free: "+safe(audit.remainingCredits),
       "Recorded job count: "+safe(audit.jobCount),
       "",
       "Breakdown by request:",
       group("Photo AI",audit.byKind?.image),
       group("Legacy film",audit.byKind?.video),
       group("Historical two-stage film",audit.byKind?.scene_video),
       group("Unknown",audit.byKind?.unknown),
       "",
       "Last saved job state (NOT billing result):",
       group("Reserved only",audit.bySavedState?.RESERVED),
       group("Submitted",audit.bySavedState?.SUBMITTED),
       group("Review required",audit.bySavedState?.REVIEW_REQUIRED),
       group("Missing job",audit.bySavedState?.missing_job),
       group("Unexpected",audit.bySavedState?.unexpected_state),
       "",
       "Credits with saved provider task ID: "+safe(audit.withSavedProviderTaskCredits),
       "Credits without saved provider task ID: "+safe(audit.withoutSavedProviderTaskCredits),
       "Partial reservation jobs: "+safe(audit.partialReservationJobs),
       "Partial reservation credits: "+safe(audit.partialReservationCredits),
       "Unreadable slots: "+safe(audit.missingSlotEntries),
       "Invalid reservation records: "+safe(audit.invalidReservationRecords),
       "",
       "Actual Runway credits charged: NOT VERIFIED BY THIS AUDIT.",
       "This view did not start generations, reset credits or change any saved data.",
       "A missing provider ID is NOT proof of zero billing."
     ].join("\n");
   }catch(e){
     display.textContent="Audit unavailable: "+String(e?.message||"storage_read_failed")+
       ". No reservation changes or new Runway jobs were made.";
   }finally{button.disabled=false;}
 });
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
   consent.checked=false;
   clearResult();
   updateChoice();
   if(currentScene)showScene(currentScene);
   else if(next==="video"&&aiEnabled&&dataUri)lookupScene();
   else state();
   message(dataUri?"Selected "+(next==="video"?"Film AI":"Photo AI")+
     ". You are in control of each paid generation.":"Choose a photo to start.");
 }
 $("photo-choice").addEventListener("click",()=>chooseProduct("photo"));
 $("film-choice").addEventListener("click",()=>chooseProduct("video"));
 function creativeChanged(){
   if(busy)return;
   currentScene=null;sceneLookupReady=false;sceneImageValid=false;
   clearResult();consent.checked=false;
   message(dataUri?"Changed the era, style or action. The previous scene cannot be reused with different settings.":"Choose a photo to start.");
   if(aiEnabled&&selectedProduct==="video"&&dataUri)lookupScene();
   else state();
 }
 look.addEventListener("change",creativeChanged);
 motion.addEventListener("change",creativeChanged);
 photo.addEventListener("change",()=>onSelect(photo.files?.[0]));
 era.addEventListener("change",creativeChanged);
 consent.addEventListener("change",state);
 form.addEventListener("submit",ev=>{ev.preventDefault();run();});
 checkMode();
})();
