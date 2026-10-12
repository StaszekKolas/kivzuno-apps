import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// No payment, Runway calls or secrets are sent from this module.
const MAX_IMAGE_DATA_URI_BYTES = 5_000_000;
const MIN_IMAGE_BYTES = 512;
export const ERAS = Object.freeze({
  egypt:"Ancient Egyptian royal court, sandstone temples and desert sunrise",
  rome:"Ancient Roman city, grand stone architecture and period costumes",
  viking:"Viking settlement in Scandinavia, wooden longhouses and Nordic fjords",
  medieval:"Medieval castle courtyard, stone towers and period garments",
  renaissance:"Italian Renaissance piazza, detailed historical architecture",
  west:"Wild West frontier town, dusty streets and sunset light",
  victorian:"Victorian London cobbled streets in warm gaslight",
  artdeco:"1920s Art Deco city glamour",
  cinema:"1940s silver-screen black and white film noir",
  retro:"1970s warm retro street photography",
  neon:"1980s neon urban nightlife",
  future:"Cinematic futuristic cyberpunk city"
});
export const MODEL = "gen4_turbo";
export const RATIO = "720:1280";
export const DURATION = 5;
export const IMAGE_MAX_BYTES = MAX_IMAGE_DATA_URI_BYTES;

export function reply(body, status=200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"cache-control":"no-store","content-type":"application/json; charset=utf-8"}
  });
}
export function parseImage(dataUri) {
  if(typeof dataUri!=="string" || dataUri.length<100 || dataUri.length>MAX_IMAGE_DATA_URI_BYTES)throw new Error("image_size");
  const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(dataUri);
  if(!match)throw new Error("image_format");
  const bytes = Buffer.from(match[2],"base64");
  if(bytes.length<MIN_IMAGE_BYTES || Buffer.byteLength(dataUri,"utf8")>MAX_IMAGE_DATA_URI_BYTES)throw new Error("image_size");
  const valid=match[1]==="png"
    ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1]==="jpeg"
      ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255
      : bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP";
  if(!valid)throw new Error("image_bytes");
  return {mime:match[1],bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),dataUri};
}
const idRegex=/^[A-Za-z0-9_-]{10,96}$/;
export function isOrderId(value) {return typeof value==="string" && idRegex.test(value);}
export function promptForEra(era) {
  if(!Object.hasOwn(ERAS,era))throw new Error("era");
  return "Five-second photorealistic cinematic shot. Animate the supplied still image as the exact opening frame. "
    +"Scene: "+ERAS[era]+". Very subtle subject movement, natural breathing and fur/hair motion, slowly tracking camera, atmospheric light. "
    +"Maintain facial identity and unique animal markings. No distorted limbs, no duplicated subjects, no additional characters. No text or logos.";
}
export function signPaidOrder({orderId,imageHash,expiresAt},secret) {
  if(!isOrderId(orderId) || !/^[a-f0-9]{64}$/.test(imageHash) || !Number.isSafeInteger(expiresAt))throw new Error("entitlement");
  return createHmac("sha256",secret).update(orderId+"\n"+imageHash+"\n"+expiresAt).digest("hex");
}
// A token must come from a trusted payment-verification webhook, not the public browser.
// No such webhook exists yet, so production Runway is disabled by default.
export function verifyPaidOrder(order,expectedHash,secret,now=Date.now()) {
  if(!order || !secret || !isOrderId(order.orderId) || order.imageHash!==expectedHash ||
    !Number.isSafeInteger(order.expiresAt) || order.expiresAt<=now ||
    order.expiresAt>now+24*60*60*1000 || typeof order.signature!=="string" ||
    !/^[a-f0-9]{64}$/.test(order.signature))return false;
  const expected=signPaidOrder(order,secret);
  return timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(order.signature,"hex"));
}
