import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const html = readFileSync('experiments/pet-walk-report/index.html','utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
const js = match?.[1] || '';

function sandbox() {
  const elements = new Map();
  let printed = 0, clipboard = '';
  function el(id) {
    if (!elements.has(id)) {
      elements.set(id,{
        id, value:'', textContent:'', style:{}, src:'', listeners:{},
        files:[], removeAttribute(name){this[name]='';},
        addEventListener(type,handler){this.listeners[type] = handler;},
        reportValidity(){return true;},
      });
    }
    return elements.get(id);
  }
  el('dog').value='Buddy';
  el('walker').value='Friendly Walks';
  el('duration').value='30 minutes';
  el('mood').value='Happy tail 🐕';
  el('conditions').value='Fresh air 🌤️';
  el('notes').value='Enjoyed an afternoon walk';
  const document = { getElementById:el };
  const window = {
    isSecureContext:true,
    print(){printed++;},
    addEventListener(){},
  };
  const navigator = {clipboard:{async writeText(text){clipboard=text;}}};
  const URL = {createObjectURL(){return 'blob:mock';},revokeObjectURL(){}};
  runInNewContext(js,{document,window,navigator,URL,Date,setTimeout,console});
  return {el,window,navigator,get printed(){return printed;},get clipboard(){return clipboard;}};
}

test('standalone HTML uses no network, cookies, storage or external scripts',()=>{
  assert.ok(html.startsWith('<!doctype html>'));
  assert.doesNotMatch(html,/<script[^>]+src=/i);
  assert.doesNotMatch(js,/\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\b|\blocalStorage\b|\bsessionStorage\b|\bdocument\.cookie\b/);
});

test('inline JavaScript parses',()=>assert.doesNotThrow(()=>new Script(js)));

test('form is accessible and print media is supported',()=>{
  assert.match(html,/<form id="form"/);
  for(const id of ['dog','date','duration','mood','conditions','notes','photo']){
    assert.match(html,new RegExp('id="'+id+'"'));
    assert.match(html,new RegExp('for="'+id+'"'));
  }
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /@media print/);
});

test('report initialises with default dog, duration and local date',()=>{
  const s=sandbox();
  assert.equal(s.el('pTitle').textContent,"Buddy's walk report");
  assert.equal(s.el('pDuration').textContent,'30 minutes');
  assert.match(s.el('date').value,/^\d{4}-\d{2}-\d{2}$/);
});

test('names and notes are output via textContent not HTML injection',()=>{
  const s=sandbox();
  s.el('dog').value='<img src=x onerror=alert(1)>';
  s.el('notes').value='<script>malicious()</script>';
  s.el('dog').listeners.input();
  assert.equal(s.el('pTitle').textContent,"<img src=x onerror=alert(1)>'s walk report");
  assert.equal(s.el('pNotes').textContent,'<script>malicious()</script>');
  assert.ok(!js.includes('innerHTML'));
});

test('print button opens native browser print without payment',()=>{
  const s=sandbox();
  s.el('print').listeners.click();
  assert.equal(s.printed,1);
  assert.doesNotMatch(html,/Stripe\.js|checkout\.stripe\.com|PAY NOW/i);
});

test('share button creates a real WhatsApp-ready plain-text report',async()=>{
  const s=sandbox();
  await s.el('share').listeners.click();
  assert.match(s.clipboard,/Buddy's walk report/);
  assert.match(s.clipboard,/30 minutes/);
  assert.match(s.clipboard,/Friendly Walks/);
  assert.match(s.el('status').textContent,/copied/i);
});

test('rejects oversized or unsupported local photos',()=>{
  const s=sandbox();
  s.el('photo').files=[{name:'large.jpg',type:'image/jpeg',size:6*1024*1024}];
  s.el('photo').listeners.change({target:s.el('photo')});
  assert.match(s.el('status').textContent,/under 5 MB/);
  assert.equal(s.el('pPhoto').style.display,'none');
});

test('prototype is separated from the production hub and is not indexed',()=>{
  assert.match(html,/name="robots" content="noindex,nofollow"/);
  const config = readFileSync('netlify.toml','utf8');
  assert.match(config,/publish\s*=\s*"hub"/);
  assert.doesNotMatch(readFileSync('hub/index.html','utf8'),/pet-walk-report/);
});
