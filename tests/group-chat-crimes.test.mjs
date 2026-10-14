import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";
const html=readFileSync(new URL("../hub/group-chat-crimes/index.html",import.meta.url),"utf8");
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,"Game must contain executable script");
function boot(search=""){
  const main={innerHTML:"",querySelectorAll:()=>[],querySelector:()=>({addEventListener(){}})};
  const share=[];
  const doc={getElementById:()=>({addEventListener(){}})};
  doc.getElementById=id=>id==="main"?main:{addEventListener(){}};
  const context=createContext({document:doc,location:{href:"https://example.test/group-chat-crimes/"+search,pathname:"/group-chat-crimes/",search},
    history:{replaceState(){}},navigator:{share:async data=>{share.push(data);}},
    URL,URLSearchParams,File:class{},setTimeout(){},console});
  runInContext(script,context);
  return {main,context,share,run:code=>runInContext(code,context)};
}
test("English, no paid external dependencies or network calls",()=>{
  assert.match(html,/<html lang="en">/);
  assert.match(html,/FREE · NO LOGIN/);
  assert.doesNotMatch(html,/fetch\(|stripe|runway|api[_-]key|<iframe/i);
});
test("five choices produce real numeric score and different verdicts",()=>{
  const x=boot();assert.match(x.main.innerHTML,/PUT ME ON TRIAL/);
  x.run("start()");assert.match(x.main.innerHTML,/EVIDENCE 1 \/ 5/);
  for(let i=0;i<5;i++)x.run("choose(2)");
  assert.match(x.main.innerHTML,/10\/10/);
  assert.match(x.main.innerHTML,/THE GROUP CHAT MENACE/);
  x.run("start()");for(let i=0;i<5;i++)x.run("choose(0)");
  assert.match(x.main.innerHTML,/0\/10/);
  assert.match(x.main.innerHTML,/THE INNOCENT LURKER/);
});
test("all result score boundaries and malicious query strings are handled",()=>{
  for(const [score,title] of [[0,"INNOCENT LURKER"],[3,"SUSPICIOUS WITNESS"],[6,"CHAOS ACCOMPLICE"],[10,"GROUP CHAT MENACE"]]){
    const x=boot("?r="+score);assert.match(x.main.innerHTML,new RegExp(title));
  }
  for(const bad of ["?r=11","?r=-1","?r=banana","?r=%3Cscript%3E"]){
    const x=boot(bad);assert.match(x.main.innerHTML,/PUT ME ON TRIAL/);
  }
});
test("share creates honest branded score and result permalink without network",async()=>{
  const x=boot();x.run("start()");for(let i=0;i<5;i++)x.run("choose(1)");
  await x.run("shareResult()");
  assert.equal(x.share.length,1);
  assert.match(x.share[0].text,/5\/10/);
  assert.match(x.share[0].text,/KIVZUNO/);
  assert.equal(x.share[0].url,"https://example.test/group-chat-crimes/?r=5");
});
