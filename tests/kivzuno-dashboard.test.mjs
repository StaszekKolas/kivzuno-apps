import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script, runInNewContext} from 'node:vm';

const html=readFileSync('hub/stats.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';

test('visitor dashboard inline JavaScript parses',()=>{
  assert.doesNotThrow(()=>new Script(js));
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
});

test('dashboard labels visits as events, not unique humans or actual purchases',()=>{
  assert.match(html,/not unique visitors or confirmed purchases/);
  assert.match(html,/Premium interest clicks \(not sales\)/);
  assert.match(html,/Externally hosted KIVZUNO apps are not included/);
});

test('dashboard lists Pet Walk Report, Facebook and TikTok from server summary',async()=>{
  const nodes=new Map();
  const el=(id)=>{
    if(!nodes.has(id))nodes.set(id,{id,textContent:'',innerHTML:'',addEventListener(){}});
    return nodes.get(id);
  };
  const document={
    getElementById:el,
    querySelectorAll(){return [];},
  };
  const stub={
    byEvent:{visit:50,start:18,complete:12,premium_click:3},
    byApp:{home:{visit:23},petreport:{visit:11,start:4,complete:3,premium_click:2}},
    bySource:{fb_reel:{visit:7},tiktok:{visit:8},ig_reel:{visit:5}},
    daily:{'2026-10-10':{visit:31,start:10,complete:6,premium_click:2}},
    generatedAt:'2026-10-10T12:00:00.000Z',
  };
  const fetch=async()=>({ok:true,json:async()=>stub});
  runInNewContext(js,{document,fetch,Date,console});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(el('visits').textContent,'50');
  assert.equal(el('home_visits').textContent,'23');
  assert.equal(el('petreport_visits').textContent,'11');
  assert.match(el('apps').innerHTML,/Pet Walk Report/);
  assert.match(el('sources').innerHTML,/Facebook Reel/);
  assert.match(el('sources').innerHTML,/TikTok/);
  assert.match(el('daily').innerHTML,/2026-10-10/);
  assert.match(el('status').textContent,/Updated:/);
});

test('dashboard does not introduce tracking cookies, remote scripts or identifiers',()=>{
  assert.doesNotMatch(html,/localStorage|sessionStorage|document\.cookie|<script\s+src=|google-analytics\.com/i);
  assert.ok(html.includes('/.netlify/functions/metrics?days='));
});
