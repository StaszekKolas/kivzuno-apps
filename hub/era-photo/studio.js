"use strict";
/*
 * KIVZUNO Era Photo — genuinely free, browser-only photo color grading.
 * NO third-party network calls, credentials, API billing, video, or false AI claims.
 * The lower-right KIVZUNO watermark is burned into the exported image pixels.
 */
(()=>{
 const $=id=>document.getElementById(id);
 const input=$("photo"),preview=$("preview"),empty=$("empty"),create=$("create");
 const download=$("download"),original=$("original"),message=$("status"),strength=$("strength");
 const MAX_FILE=12*1024*1024, MAX_SIDE=2048;
 const looks=Object.freeze({
   viking:{filter:[1.20,.78,.12,.92],tint:["#366878","#dab078"],light:"#9abcca",mist:true,particles:0.55},
   medieval:{filter:[1.18,.92,.19,1.05],tint:["#8d522a","#f3c678"],light:"#f4c175",mist:false,particles:0.25},
   west:{filter:[1.19,.78,.48,1.02],tint:["#a46f3b","#e0a866"],light:"#ffbc65",mist:false,particles:0.85},
   victorian:{filter:[1.24,.62,.22,.88],tint:["#3b4d65","#a9a7a0"],light:"#b9b9bf",mist:true,particles:0.32},
   rome:{filter:[1.15,.94,.33,1.06],tint:["#957b4b","#e9c77a"],light:"#f9d78e",mist:false,particles:0.22},
   jazz:{filter:[1.35,.63,.52,.94],tint:["#32344c","#e8b27b"],light:"#fad7aa",mist:false,particles:0.1}
 });
 let chosen="viking",loaded=null,loadedUrl="",resultUrl="",resultBlob=null;
 let viewOriginal=false,busy=false;
 const setMessage=(text,kind="")=>{message.textContent=text;message.dataset.kind=kind;};
 const setReady=ready=>{
   create.disabled=!ready||busy;
   download.disabled=!resultBlob||busy;
   original.disabled=!resultBlob||busy;
 };
 function revokeUrl(url){if(url)URL.revokeObjectURL(url);}
 function resetOutput(){
   revokeUrl(resultUrl);resultUrl="";resultBlob=null;viewOriginal=false;
   $("result-label").textContent="Create your photo to unlock a watermarked download.";
   original.textContent="View original";setReady(Boolean(loaded));
   if(loadedUrl){preview.src=loadedUrl;preview.hidden=false;empty.hidden=true;}
   else{preview.hidden=true;preview.removeAttribute("src");empty.hidden=false;}
 }
 function random(seed){return ()=>{
   seed|=0;seed=seed+0x6D2B79F5|0;
   let t=Math.imul(seed^(seed>>>15),1|seed);
   t=t+Math.imul(t^(t>>>7),61|t)^t;
   return ((t^(t>>>14))>>>0)/4294967296;
 };}
 function roundRect(ctx,x,y,w,h,r){
   const rad=Math.min(r,w/2,h/2);
   ctx.beginPath();ctx.moveTo(x+rad,y);ctx.lineTo(x+w-rad,y);
   ctx.quadraticCurveTo(x+w,y,x+w,y+rad);
   ctx.lineTo(x+w,y+h-rad);ctx.quadraticCurveTo(x+w,y+h,x+w-rad,y+h);
   ctx.lineTo(x+rad,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-rad);
   ctx.lineTo(x,y+rad);ctx.quadraticCurveTo(x,y,x+rad,y);ctx.closePath();
 }
 function burnKivzunoWatermark(ctx,w,h){
   // Relative pixel coordinates put watermark INSIDE exported JPEG, lower-right.
   const font=Math.max(13,Math.min(29,Math.round(w*.018)));
   const pad=Math.max(12,Math.round(w*.016));
   ctx.save();
   ctx.font="800 "+font+"px system-ui,-apple-system,Segoe UI,sans-serif";
   const text="KIVZUNO",width=ctx.measureText(text).width;
   const pillW=width+font*1.14,pillH=font*1.8;
   const x=w-pad-pillW,y=h-pad-pillH;
   ctx.fillStyle="rgba(5,12,22,.54)";
   roundRect(ctx,x,y,pillW,pillH,font*.43);ctx.fill();
   ctx.textAlign="right";ctx.textBaseline="middle";
   ctx.fillStyle="#ffffff";
   ctx.shadowColor="rgba(0,0,0,.5)";ctx.shadowBlur=Math.max(1,font*.12);
   ctx.fillText(text,w-pad-font*.55,y+pillH/2+font*.01);
   ctx.restore();
 }
 function drawCinematicLook(canvas,image,era,intensity){
   const ctx=canvas.getContext("2d",{alpha:false});
   if(!ctx)throw Error("Your browser could not open the image editor.");
   const w=canvas.width,h=canvas.height,p=looks[era],k=intensity/100;
   ctx.fillStyle="#101625";ctx.fillRect(0,0,w,h);
   ctx.save();
   ctx.filter="contrast("+(1+(p.filter[0]-1)*k)+") saturate("+
     (1+(p.filter[1]-1)*k)+") sepia("+(p.filter[2]*k)+
     ") brightness("+(1+(p.filter[3]-1)*k)+")";
   ctx.drawImage(image,0,0,w,h);ctx.restore();
   if(k>0){
     ctx.save();
     ctx.globalCompositeOperation="soft-light";ctx.globalAlpha=.37*k;
     const tint=ctx.createLinearGradient(0,0,w,h);
     tint.addColorStop(0,p.tint[0]);tint.addColorStop(1,p.tint[1]);
     ctx.fillStyle=tint;ctx.fillRect(0,0,w,h);
     ctx.restore();
     ctx.save();ctx.globalCompositeOperation="screen";
     const glow=ctx.createRadialGradient(w*.78,h*.14,0,w*.78,h*.14,w*.94);
     glow.addColorStop(0,p.light+"99");glow.addColorStop(.45,p.light+"2a");
     glow.addColorStop(1,p.light+"00");
     ctx.globalAlpha=.54*k;ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.restore();
     if(p.mist){
       ctx.save();
       ctx.globalAlpha=.055*k;
       for(let i=0;i<7;i++){
         const fog=ctx.createRadialGradient(w*(.1+i*.15),h*(.62+(i%3)*.12),0,
            w*(.1+i*.15),h*(.62+(i%3)*.12),w*.48);
         fog.addColorStop(0,"#dce7ef");fog.addColorStop(1,"#dce7ef00");
         ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);
       }
       ctx.restore();
     }
     const rand=random(w*151+h*43+era.split("").reduce((a,c)=>a+c.charCodeAt(0),0));
     const amount=Math.min(1650,Math.round((w*h/1050)*p.particles*k));
     ctx.save();
     ctx.globalCompositeOperation="screen";
     for(let i=0;i<amount;i++){
       const px=rand()*w,py=rand()*h,r=.35+rand()*Math.max(1.5,w*.0023);
       ctx.globalAlpha=(.04+.19*rand())*k;
       ctx.fillStyle=i%3?"#f5d9aa":"#e8f6f3";
       ctx.beginPath();ctx.ellipse(px,py,r,r*(.65+rand()),0,0,2*Math.PI);ctx.fill();
     }
     ctx.restore();
     // Subtle vignette improves the atmosphere while keeping subjects visible.
     ctx.save();
     const vignette=ctx.createRadialGradient(w*.5,h*.46,Math.min(w,h)*.22,
       w*.5,h*.46,Math.hypot(w,h)*.67);
     vignette.addColorStop(0,"rgba(6,10,19,0)");
     vignette.addColorStop(1,"rgba(6,10,19,"+(.57*k)+")");
     ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);ctx.restore();
   }
   burnKivzunoWatermark(ctx,w,h);
 }
 function blobOf(canvas){
   return new Promise((resolve,reject)=>
     canvas.toBlob(b=>b?resolve(b):reject(Error("Could not export your photo.")),
       "image/jpeg",.91));
 }
 async function onFile(file){
   if(busy||!file)return;
   if(file.size>MAX_FILE){setMessage("That photo is too large (max 12 MB).","error");return;}
   if(!file.type.startsWith("image/")&& !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)){
     setMessage("Choose a JPEG, PNG, WebP or supported iPhone HEIC photo.","error");return;
   }
   const url=URL.createObjectURL(file),image=new Image();
   try{
     await new Promise((resolve,reject)=>{
       image.onload=resolve;image.onerror=()=>reject(Error("This image format could not be opened. Try JPG or PNG."));
       image.src=url;
     });
     if(!image.naturalWidth||!image.naturalHeight)throw Error("The selected photo is invalid.");
     revokeUrl(loadedUrl);loadedUrl=url;loaded=image;
     resetOutput();
     $("photo-label").textContent=file.name.length>35?file.name.slice(0,32)+"…":file.name;
     setMessage("Photo ready. Choose a look, then create your free watermarked image.");
   }catch(e){
     revokeUrl(url);setMessage(String(e.message),"error");
   }
 }
 async function render(ev){
   ev.preventDefault();
   if(!loaded||busy)return;
   busy=true;setReady(false);
   setMessage("Creating a cinematic look on your device…");
   try{
     const scale=Math.min(1,MAX_SIDE/Math.max(loaded.naturalWidth,loaded.naturalHeight));
     const w=Math.max(1,Math.round(loaded.naturalWidth*scale));
     const h=Math.max(1,Math.round(loaded.naturalHeight*scale));
     const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
     drawCinematicLook(canvas,loaded,chosen,Number(strength.value));
     const result=await blobOf(canvas);
     revokeUrl(resultUrl);resultBlob=result;resultUrl=URL.createObjectURL(result);
     viewOriginal=false;preview.src=resultUrl;preview.hidden=false;empty.hidden=true;
     original.textContent="View original";
     $("result-label").textContent="Ready: "+w+" × "+h+" JPEG, watermark included. The picture never left your device.";
     setMessage("Your free photo is ready — watermark included in the download.");
   }catch(e){setMessage("Could not create this photo: "+String(e.message),"error");}
   finally{busy=false;setReady(Boolean(loaded));}
 }
 async function save(){
   if(!resultBlob)return;
   const name="kivzuno-"+chosen+"-photo.jpg";
   try{
     if(navigator.canShare&&navigator.share){
       const f=new File([resultBlob],name,{type:"image/jpeg"});
       if(navigator.canShare({files:[f]})){
         await navigator.share({files:[f],title:"KIVZUNO Era Photo"});return;
       }
     }
   }catch(e){if(e.name==="AbortError")return;}
   const link=document.createElement("a");link.href=resultUrl;link.download=name;
   document.body.append(link);link.click();link.remove();
   setMessage("Saved the watermarked photo. On iPhone, check Downloads or choose Save Image from Share.");
 }
 input.addEventListener("change",()=>onFile(input.files?.[0]));
 $("eras").addEventListener("click",ev=>{
   const button=ev.target.closest("button[data-era]");
   if(!button||busy||!Object.hasOwn(looks,button.dataset.era))return;
   chosen=button.dataset.era;
   document.querySelectorAll("button[data-era]").forEach(b=>
     b.setAttribute("aria-pressed",String(b===button)));
   if(resultBlob){resetOutput();setMessage("New era selected. Create another FREE look from your photo.");}
 });
 strength.addEventListener("input",()=>{
   $("strength-value").textContent=strength.value+"%";
   if(resultBlob){resetOutput();setMessage("Effect intensity changed. Create your photo again for free.");}
 });
 original.addEventListener("click",()=>{
   if(!resultBlob)return;
   viewOriginal=!viewOriginal;
   preview.src=viewOriginal?loadedUrl:resultUrl;
   original.textContent=viewOriginal?"View finished photo":"View original";
 });
 download.addEventListener("click",save);
 $("editor").addEventListener("submit",render);
 setReady(false);
})();
