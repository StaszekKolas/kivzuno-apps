import test from "node:test";
import assert from "node:assert/strict";
import {RULES,decode,decodeById,shareLink} from "../hub/text-decoder/decoder.mjs";

test("every rule has a unique shareable id and bounded drama score",()=>{
 const ids=RULES.map(r=>r.id);
 assert.equal(ids.length,new Set(ids).size);
 for(const rule of RULES){assert.ok(rule.drama>=0&&rule.drama<=100);assert.ok(rule.reply);assert.ok(decodeById(rule.id));}
});
test("recognises iconic texts and prioritises specific phrases",()=>{
 assert.equal(decode("We need to talk.").id,"talk");
 assert.equal(decode("I'm fine.").id,"fine");
 assert.equal(decode("K").id,"k");
 assert.equal(decode("Whatever").id,"whatever");
 assert.equal(decode("OK.").id,"ok");
 assert.equal(decode("No worries!").id,"worries");
 assert.equal(decode("Maybe").id,"maybe");
});
test("handles blanks and unrecognised texts without AI or external calls",()=>{
 assert.equal(decode("  "),null);
 const a=decode("the penguin ate the receipts");
 const b=decode("the penguin ate the receipts");
 assert.deepEqual(a,b);
 assert.ok(a.id.startsWith("wildcard-"));
});
test("does not accidentally decode single K inside another word",()=>{
 assert.notEqual(decode("kangaroo").id,"k");
});
test("share link contains only a known result id, not the original message",()=>{
 const original="Super secret medical detail";
 const r=decode(original);
 const link=shareLink("https://kivzuno-hub.netlify.app/text-decoder/?src=ig#old",r.id);
 const url=new URL(link);
 assert.equal(url.searchParams.get("r"),r.id);
 assert.equal(url.searchParams.size,1);
 assert.equal(url.hash,"");
 assert.ok(!link.includes(original));
 assert.ok(!link.includes("src="));
 assert.equal(decodeById("unknown"),null);
 assert.throws(()=>shareLink("https://example.com/","fake"));
});
test("a long message is safely bounded; original text is not in the returned object",()=>{
 const privateText="My private information";
 const result=decode(privateText+"a".repeat(800));
 assert.ok(result);
 assert.ok(!JSON.stringify(result).includes(privateText));
});
