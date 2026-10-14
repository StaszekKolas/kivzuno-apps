"use strict";
(()=>{
  const $=id=>document.getElementById(id);
  const MAX=12*1024*1024;
  const periods=Object.freeze({
    viking:"Viking settlement, Norse timber houses, rugged fjord atmosphere, muddy road and era-appropriate wooden transport",
    medieval:"medieval town, cobblestone or dirt roads, timber-and-stone buildings, believable medieval transport and period garments",
    west:"Wild West frontier, dust-covered road, timber saloons, wagons and period frontier clothing",
    victorian:"Victorian London, wet cobblestones, gas lamps, historical coaches and period-accurate garments",
    rome:"ancient Roman streets, realistic sandstone and marble buildings, historic carts, togas and sunlit atmosphere",
    jazz:"1920s period street, art-deco buildings, era-correct cars, clothes and lively jazz-age ambience"
  });
  const styles=Object.freeze({
    faithful:"Keep the original poses, faces, pet markings, headcount, subject order, frame geometry and camera placement as closely as possible.",
    cinematic:"Preserve the source identities and spatial layout. Make the scene a vivid, natural mid-action moment with credible wind and environmental effects.",
    epic:"Preserve the source identities, exact number of subjects, original left-to-right layout and identifiable features. Increase cinematic scale, dynamic weather and tension without caricatures."
  });
  let originalUrl="",resultUrl="",markedUrl="",markedBlob=null,resultImage=null;
  const safe=(file)=>file&&file.size>0&&file.size<=MAX&&
    (file.type.startsWith("image/")||/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name));
  function invalidate(){
    if(markedUrl)URL.revokeObjectURL(markedUrl);
    markedUrl="";markedBlob=null;$("save").disabled=true;
  }
  function loadImage(file){
    return new Promise((resolve,reject)=>{
      if(!safe(file)){reject(Error("Choose a supported photo up to 12 MB."));return;}
      const url=URL.createObjectURL(file),image=new Image();
      image.onload=()=>resolve({url,image});
      image.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Cannot open image. Try JPEG or PNG."));};
      image.src=url;
    });
  }
  $("source").addEventListener("change",async()=>{
    const file=$("source").files?.[0];if(!file)return;
    try{
      const data=await loadImage(file);
      if(originalUrl)URL.revokeObjectURL(originalUrl);
      originalUrl=data.url;$("source-preview").src=originalUrl;$("source-preview").hidden=false;
      $("prompt-status").textContent="Source preview ready. It stays on your device. You will need to attach it to ChatGPT manually.";
    }catch(e){$("prompt-status").textContent=String(e.message);}
  });
  $("prepare").addEventListener("click",()=>{
    const era=$("era").value,style=$("style").value;
    if(!Object.hasOwn(periods,era)||!Object.hasOwn(styles,style))return;
    $("prompt").value=[
      "EDIT THE UPLOADED SOURCE PHOTO, not a new random group portrait.",
      "Transform its setting into a photorealistic historical scene from: "+periods[era]+".",
      "Priorities: preserve identifiable people and animals, exact numbers, coat markings, face likeness, body positions, framing, camera angle, scale and left-to-right order.",
      "Change ONLY modern elements that exist in the source. If a modern vehicle exists, transform it into realistic transport from this historical era in the exact same location. Replace modern asphalt, houses, fences and clothing as appropriate. Never invent people, pets or vehicles.",
      styles[style],
      "Show authentic action (walking, pulling, gesture or real environment movement) fitting this particular photo, with cinematic depth and natural light.",
      "Do not create extra people or animals, deform anatomy or leave modern objects unchanged. Maintain original aspect ratio. No large logo, no captions.",
      "Return ONE beautiful, dynamic, photorealistic transformed image."
    ].join("\n\n");
    $("copy").disabled=false;
    $("prompt-status").textContent="Prompt ready. Copy it, open ChatGPT, and attach the original photograph there. This site does NOT send or generate anything.";
  });
  $("copy").addEventListener("click",async()=>{
    const val=$("prompt").value;if(!val)return;
    try{await navigator.clipboard.writeText(val);$("prompt-status").textContent="Copied. Open ChatGPT, attach the original and paste this prompt.";}
    catch{
      $("prompt").focus();$("prompt").select();
      $("prompt-status").textContent="Select and copy the highlighted prompt manually.";
    }
  });
  $("result").addEventListener("change",async()=>{
    const file=$("result").files?.[0];if(!file)return;
    try{
      const data=await loadImage(file);
      if(resultUrl)URL.revokeObjectURL(resultUrl);
      resultUrl=data.url;resultImage=data.image;
      invalidate();
      $("result-preview").src=resultUrl;$("result-preview").hidden=false;
      $("watermark").disabled=false;
      $("result-status").textContent="Result loaded locally. Apply the embedded KIVZUNO watermark before saving.";
    }catch(e){$("result-status").textContent=String(e.message);}
  });
  function roundRect(ctx,x,y,w,h,r){
    const v=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+v,y);ctx.lineTo(x+w-v,y);ctx.quadraticCurveTo(x+w,y,x+w,y+v);
    ctx.lineTo(x+w,y+h-v);ctx.quadraticCurveTo(x+w,y+h,x+w-v,y+h);
    ctx.lineTo(x+v,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-v);
    ctx.lineTo(x,y+v);ctx.quadraticCurveTo(x,y,x+v,y);ctx.closePath();
  }
  function embedWatermark(ctx,w,h){
    const font=Math.max(11,Math.min(27,Math.round(w*.018)));
    const pad=Math.max(10,Math.round(w*.016));
    const name="KIVZUNO";ctx.save();ctx.font="800 "+font+"px system-ui,sans-serif";
    const width=ctx.measureText(name).width;
    const pillW=width+font*1.1,pillH=font*1.76;
    const x=w-pillW-pad,y=h-pillH-pad;
    ctx.fillStyle="rgba(11,18,28,.56)";roundRect(ctx,x,y,pillW,pillH,font*.35);ctx.fill();
    ctx.textBaseline="middle";ctx.textAlign="right";ctx.fillStyle="#fff";
    ctx.fillText(name,w-pad-font*.52,y+pillH*.51);ctx.restore();
  }
  $("watermark").addEventListener("click",async()=>{
    if(!resultImage)return;
    $("watermark").disabled=true;
    try{
      const factor=Math.min(1,2600/Math.max(resultImage.naturalWidth,resultImage.naturalHeight));
      const w=Math.max(1,Math.round(resultImage.naturalWidth*factor));
      const h=Math.max(1,Math.round(resultImage.naturalHeight*factor));
      const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d",{alpha:false});
      if(!ctx)throw Error("Canvas unavailable.");
      ctx.drawImage(resultImage,0,0,w,h);embedWatermark(ctx,w,h);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):
        reject(Error("Could not export the watermarked photo.")),"image/jpeg",.94));
      invalidate();markedBlob=blob;markedUrl=URL.createObjectURL(blob);
      $("result-preview").src=markedUrl;$("save").disabled=false;
      $("result-status").textContent="Watermark burned into the JPEG at bottom right. Download is free; no image was sent to KIVZUNO.";
    }catch(e){$("result-status").textContent=String(e.message);}
    finally{$("watermark").disabled=false;}
  });
  $("save").addEventListener("click",async()=>{
    if(!markedBlob||!markedUrl)return;
    const name="KIVZUNO_Era_Photo.jpg";
    try{
      if(navigator.share&&navigator.canShare){
        const file=new File([markedBlob],name,{type:"image/jpeg"});
        if(navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:"KIVZUNO Era Photo"});return;
        }
      }
    }catch(e){if(e.name==="AbortError")return;}
    const a=document.createElement("a");a.href=markedUrl;a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    $("result-status").textContent="Save initiated. Check your Files/Downloads folder on iPhone.";
  });
})();
