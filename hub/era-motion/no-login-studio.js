"use strict";
// Client UI for private, server-side image generation. No Puter authentication.
// Unavailable until the owner supplies a Runway API key and approves a tightly capped budget.
(()=>{
  const $=id=>document.getElementById(id);
  const form=$("accountless-image"),button=$("accountless-generate"),info=$("accountless-status"),consent=$("accountless-consent");
  if(!form || !button || !info || !consent)return;
  let ready=false,busy=false;
  const snapshot=()=>window.kivzunoEraMotion?.snapshot?.()||{};
  const msg=s=>{info.textContent=s;};
  function refresh(){
    const {photo,era}=snapshot();
    button.disabled=!ready || busy || !photo || !era || !consent.checked;
  }
  async function readiness(){
    msg("Checking whether the no-login photo service is activated…");
    try{
      const res=await fetch("/.netlify/functions/era-image-task",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"capabilities"}),credentials:"same-origin"
      });
      const data=await res.json();
      ready=Boolean(res.ok && data.available);
      if(ready){
        msg("No Puter login required. Owner-funded Runway images are available with a limited daily free quota.");
      }else{
        msg("Not yet active: KIVZUNO's owner has not connected and approved a server-side AI budget. Your Puter login is NOT required by this future service, but free AI generation cannot begin yet.");
      }
    }catch{
      ready=false;
      msg("The server-side image service could not be reached. No generation or payment was attempted.");
    }
    refresh();
  }
  async function start(){
    const {photo,companion,era}=snapshot();
    if(busy || !ready || !photo || !consent.checked)return;
    busy=true;refresh();
    msg("Sending the chosen image to KIVZUNO's server to create a new scene…");
    const currentEra=era;
    try{
      const response=await fetch("/.netlify/functions/era-image-task",{
        method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({action:"start",photo,companion,era,consent:true})
      });
      const data=await response.json();
      if(!response.ok || data.status!=="SUBMITTED" || !data.jobId || !data.accessToken) {
        throw new Error(data?.error||"image generation could not start");
      }
      msg("Your photo is being transformed. Keep this page open. No payment is required from you.");
      for(let attempt=0;attempt<60;attempt++){
        await new Promise(resolve=>setTimeout(resolve,5000));
        if(snapshot().era!==currentEra)throw new Error("The era has changed. This result will not be applied.");
        const statusResponse=await fetch("/.netlify/functions/era-image-task",{
          method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
          body:JSON.stringify({action:"status",jobId:data.jobId,accessToken:data.accessToken})
        });
        const state=await statusResponse.json();
        if(!statusResponse.ok)throw new Error(state?.error||"image job could not be checked");
        if(state.status==="SUCCEEDED" && typeof state.imageUrl==="string"){
          await window.kivzunoEraMotion.acceptServerImage(state.imageUrl,currentEra);
          msg("✓ Your AI photo is ready. The picture can be downloaded and transferred to video generation without uploading it again.");
          return;
        }
        if(state.status==="FAILED" || state.status==="REVIEW_REQUIRED")
          throw new Error("The image model did not finish successfully; no automatic retry was started.");
      }
      throw new Error("Still processing. The provider has not returned a result within five minutes.");
    }catch(err){
      msg("Image generation could not finish: "+String(err?.message||err).slice(0,170));
    }finally{busy=false;refresh();}
  }
  form.addEventListener("submit",ev=>{ev.preventDefault();start();});
  consent.addEventListener("change",refresh);
  window.addEventListener("kivzuno:result-change",refresh);
  $("photo").addEventListener("change",()=>{consent.checked=false;refresh();});
  $("companion").addEventListener("change",()=>{consent.checked=false;refresh();});
  readiness();
})();
