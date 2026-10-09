import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const html = readFileSync('experiments/pet-walk-report/index.html','utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
const js = match?.[1] || '';

function sandbox({ production = false, gpc = false } = {}) {
  const elements = new Map();
  let printed = 0, clipboard = '';
  const events = [];
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
  const navigator = {
    globalPrivacyControl:gpc,
    clipboard:{async writeText(text){clipboard=text;}}
  };
  const location = production ? {
    hostname:'kivzuno-hub.netlify.app', search:'?src=fb_reel'
  } : undefined;
  const fetch = async (url, opts) => {
    assert.equal(url,'/.netlify/functions/metrics');
    events.push(JSON.parse(opts.body));
    return {ok:true,status:204};
  };
  const URL = {createObjectURL(){return 'blob:mock';},revokeObjectURL(){}};
  runInNewContext(js,{document,window,navigator,location,fetch,URL,URLSearchParams,Date,setTimeout,console});
  return {el,window,navigator,events,get printed(){return printed;},get clipboard(){return clipboard;}};
}

test('public HTML has no third-party scripts, cookies, storage or outbound pet details',()=>{
  assert.ok(html.startsWith('<!doctype html>'));
  assert.doesNotMatch(html,/<script[^>]+src=/i);
  assert.match(js, /fetch\('\/\.netlify\/functions\/metrics'/);
  assert.doesNotMatch(js,/\bXMLHttpRequest\b|\bsendBeacon\b|\blocalStorage\b|\bsessionStorage\b|\bdocument\.cookie\b/);
  assert.doesNotMatch(html,/checkout\.stripe\.com|sk_live_|pk_live_/);
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

test('free demo is included in published Netlify hub but remains payment-free',()=>{
  assert.match(html, /I'd consider the £9\.99 Pro pack/);
  assert.match(html, /No payment, no email collection/);
  const config = readFileSync('netlify.toml','utf8');
  assert.match(config,/publish\s*=\s*"hub"/);
  assert.match(readFileSync('hub/index.html','utf8'), /pet-walk-report/);
  assert.equal(readFileSync('hub/pet-walk-report/index.html','utf8'),html);
});


test('only anonymous enum events leave the public report; no pet names or notes',async()=>{
  const s=sandbox({production:true});
  s.el('dog').value='PRIVATE_DOG_PERSONAL';
  s.el('notes').value='PRIVATE_NOTES';
  s.el('dog').listeners.input();
  s.el('proInterest').listeners.click();
  s.el('proInterest').listeners.click();
  await s.el('share').listeners.click();
  assert.deepEqual(s.events.map(e=>e.event), ['visit','start','premium_click','complete']);
  for(const e of s.events){
    assert.deepEqual(Object.keys(e).sort(),['app','event','source']);
    assert.equal(e.app,'petreport');
    assert.equal(e.source,'fb_reel');
    assert.doesNotMatch(JSON.stringify(e),/PRIVATE_DOG_PERSONAL|PRIVATE_NOTES/);
  }
});

test('global privacy control blocks every analytics event',async()=>{
  const s=sandbox({production:true,gpc:true});
  s.el('dog').listeners.input();
  s.el('proInterest').listeners.click();
  s.el('print').listeners.click();
  assert.equal(s.events.length,0);
});

test('server-side metric allowlist accepts petreport premium-interest event',()=>{
  const metrics=readFileSync('netlify/functions/metrics.mjs','utf8');
  assert.match(metrics,/const apps = .*"petreport"/);
  assert.match(metrics,/\["battery", "flag", "petreport"\]/);
});
