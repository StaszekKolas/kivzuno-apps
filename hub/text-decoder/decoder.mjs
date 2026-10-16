/**
 * KIVZUNO Text Decoder — a deliberately silly rule-based game.
 * No API calls, profiling, AI or message uploads. Not a real sentiment detector.
 */
export const RULES = Object.freeze([
  { id:"talk", pattern:/\bwe\s+need\s+to\s+talk\b/i, label:"WE NEED TO TALK", emoji:"🚨", drama:98, title:"Emergency meeting detected", meaning:"The calendar invite from your nightmares. Could be about the bins. Probably not.", reply:"Should I bring a lawyer or a snack?" },
  { id:"fine", pattern:/\b(i(?:'|’)m\s+fine|i\s+am\s+fine|fine\.{0,3})\b/i, label:"I'M FINE", emoji:"🌋", drama:93, title:"Volcano on airplane mode", meaning:"The words say fine. The dramatic soundtrack says otherwise.", reply:"Cool. I'll be over here wearing a helmet." },
  { id:"k", pattern:/^\s*k[.!?]*\s*$/i, label:"K", emoji:"⚖️", drama:96, title:"One-letter courtroom drama", meaning:"Three paragraphs entered. One letter left. Friendship on trial.", reply:"Thank you for your detailed 400-page response." },
  { id:"whatever", pattern:/\bwhatever\b/i, label:"WHATEVER", emoji:"🔥", drama:91, title:"The final boss of indifference", meaning:"Unofficial translation: an argument has entered its sequel era.", reply:"I'll take that as a beautifully unclear yes." },
  { id:"seen", pattern:/\b(left on read|seen|read at\s+\d)/i, label:"SEEN", emoji:"👀", drama:86, title:"Read receipts, emotional damage", meaning:"Your message got an audience but no standing ovation.", reply:"Glad my TED Talk reached you." },
  { id:"busy", pattern:/\b(busy|can't talk|cannot talk)\b/i, label:"BUSY", emoji:"📆", drama:67, title:"Calendar mystery", meaning:"Possibly genuinely busy. Possibly in a very serious meeting with the sofa.", reply:"No worries. Tell your calendar I said hi." },
  { id:"maybe", pattern:/\b(maybe|we'll see|we will see)\b/i, label:"MAYBE", emoji:"🎲", drama:75, title:"The commitment escape hatch", meaning:"A yes wearing a fake moustache. Or a no with excellent PR.", reply:"I'll pencil it in for the year 2099." },
  { id:"sure", pattern:/\bsure[.!?]*\b/i, label:"SURE", emoji:"🙂", drama:71, title:"Suspiciously short approval", meaning:"Could be agreement. Could be a tiny sarcastic thundercloud.", reply:"Amazing. I shall frame this enthusiastic response." },
  { id:"lol", pattern:/\b(lol|lmao|haha+)\b/i, label:"LOL", emoji:"😂", drama:27, title:"Polite laugh department", meaning:"One small laugh. Actual laughter not independently verified.", reply:"I'll be here all week. Unfortunately." },
  { id:"way", pattern:/\b(on my way|omw|be there soon)\b/i, label:"ON MY WAY", emoji:"🚗", drama:52, title:"Teleportation pending", meaning:"Distance from home: classified. Shoes: possibly not yet located.", reply:"Great. Shall I start the stopwatch or the kettle?" },
  { id:"ok", pattern:/^\s*(ok|okay|okie|kk)[.!?]*\s*$/i, label:"OK", emoji:"🧊", drama:76, title:"Frost warning", meaning:"Two letters. So many possible weather conditions.", reply:"Love the energy. Truly electric." },
  { id:"worries", pattern:/\b(no worries|it's okay|all good)\b/i, label:"NO WORRIES", emoji:"🕊️", drama:44, title:"Peace treaty, probably", meaning:"They may really mean it. Your overthinking subscription has other plans.", reply:"Perfect. My brain will only replay this 17 times." }
]);
const FALLBACKS = Object.freeze([
  {id:"wildcard-0",label:"MYSTERY TEXT",emoji:"🔮",drama:39,title:"Mildly mysterious",meaning:"This message has been classified as 'needs more context and a biscuit'.",reply:"Interesting. The plot thickens."},
  {id:"wildcard-1",label:"MYSTERY TEXT",emoji:"🕵️",drama:62,title:"The plot is plotting",meaning:"Could be totally normal. Could be the start of season two.",reply:"I have so many questions and exactly no answers."},
  {id:"wildcard-2",label:"MYSTERY TEXT",emoji:"🫖",drama:55,title:"Tea-leaf intelligence",meaning:"Our totally unqualified decoding committee recommends snacks before conclusions.",reply:"Noted. Filing this under 'intriguing'."}
]);
function hash(text){let h=2166136261;for(const char of text){h^=char.codePointAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function decode(text){
  const clean=String(text??"").trim().slice(0,500);
  if(!clean) return null;
  const found=RULES.find(rule=>rule.pattern.test(clean))||FALLBACKS[hash(clean.toLowerCase())%FALLBACKS.length];
  const {pattern,...publicFields}=found;
  return {...publicFields,tagline:"Certified nonsense. 0% mind-reading. 100% drama.",disclaimer:"For entertainment only. Don't use this to judge real people."};
}
export function decodeById(id){
  const all=[...RULES,...FALLBACKS];
  const rule=all.find(entry=>entry.id===id);
  if(!rule) return null;
  const {pattern,...fields}=rule;
  return {...fields,tagline:"Certified nonsense. 0% mind-reading. 100% drama.",disclaimer:"For entertainment only. Don't use this to judge real people."};
}
export function shareLink(currentUrl,resultId){
  if(!decodeById(resultId)) throw new Error("Unknown result");
  const u=new URL(currentUrl);u.search="";u.hash="";u.searchParams.set("r",resultId);return u.toString();
}
