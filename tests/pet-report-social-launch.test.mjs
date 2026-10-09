import test from 'node:test';
import assert from 'node:assert/strict';
import {run, APP, VIDEO, CAPTIONS} from '../scripts/buffer/publish-pet-report-launch.mjs';

function mock({siteOk=true,mediaOk=true,existing=[],reject=false}={}){
 const calls=[],logs=[];
 const request=async(url,opt)=>{
  if(url.startsWith(APP)){
   return {ok:siteOk,url:APP,text:async()=>'<title>Pet Walk Report</title><article id="report">Save / print PDF. No payment.</article>'};
  }
  if(url===VIDEO){
   return {ok:mediaOk,headers:{get:()=>mediaOk?'video/mp4':'text/html'}};
  }
  assert.equal(url,'https://api.buffer.com');
  const q=JSON.parse(opt.body).query;
  calls.push(q);
  let data;
  if(q.includes('account { organizations'))data={account:{organizations:[{id:'org'}]}};
  else if(q.includes('channels(input:'))data={channels:[
   {id:'ig',name:'kivzuno',service:'instagram'},
   {id:'fb',name:'KIVZUNO',service:'facebook'},
   {id:'tt',name:'.kivzuno',service:'tiktok'}]};
  else if(q.includes('posts(first:'))data={posts:{
   edges:existing.map(p=>({node:p})),
   pageInfo:{hasNextPage:false,endCursor:null}}};
  else if(q.includes('mutation'))data={createPost:reject
   ?{__typename:'MutationError',message:'refused'}
   :{__typename:'PostActionSuccess',post:{id:'fake'+calls.length,status:'sending',channelId:'ig'}}};
  else throw Error('Unexpected Buffer GraphQL');
  return {ok:true,json:async()=>({data})};
 };
 return {request,calls,logs,log:msg=>logs.push(msg)};
}

test('all channels accept approved free campaign once',async()=>{
 const m=mock();
 const result=await run({token:'SYNTHETIC',request:m.request,log:m.log});
 assert.equal(result.accepted,3);
 const writes=m.calls.filter(s=>s.includes('mutation'));
 assert.equal(writes.length,3);
 assert.ok(writes.every(s=>s.includes('mode: shareNow')));
 assert.ok(writes.every(s=>s.includes('assets: [{ video:')));
 assert.ok(writes.every(s=>!s.includes('firstComment')));
 assert.ok(m.logs.some(s=>s.includes('DONE 3')));
});

test('inspection never mutates and checks real app and media',async()=>{
 const m=mock();
 const result=await run({token:'SYNTHETIC',request:m.request,log:m.log,mode:'inspect'});
 assert.equal(result.accepted,0);
 assert.equal(result.pending,3);
 assert.ok(!m.calls.some(s=>s.includes('mutation')));
});

test('a previously sent Facebook post must not be sent again',async()=>{
 const m=mock({existing:[{id:'old',channelId:'fb',text:CAPTIONS.facebook,status:'sent'}]});
 const result=await run({token:'SYNTHETIC',request:m.request,log:m.log});
 assert.equal(result.accepted,2);
 assert.ok(m.logs.some(s=>s.includes('facebook: SKIPPED')));
});

test('missing production page or video blocks all Buffer mutations',async()=>{
 for(const options of [{siteOk:false},{mediaOk:false}]){
  const m=mock(options);
  await assert.rejects(run({token:'SYNTHETIC',request:m.request,log:m.log}));
  assert.equal(m.calls.length,0);
 }
});

test('the exact three source-tagged free-app URLs are in captions',()=>{
 for(const s of ['instagram','facebook','tiktok']){
  assert.match(CAPTIONS[s],/https:\/\/kivzuno-hub\.netlify\.app\/pet-walk-report\/\?src=/);
  assert.ok(!CAPTIONS[s].includes('£9.99'));
 }
});

test('Buffer rejection does not retry or leak the API key',async()=>{
 const m=mock({reject:true});
 await assert.rejects(run({token:'SYNTHETIC',request:m.request,log:m.log}),/submission failed/);
 assert.equal(m.calls.filter(s=>s.includes('mutation')).length,1);
 assert.ok(m.logs.every(x=>!x.includes('SYNTHETIC')));
});

test('free plan guard blocks a full queue',async()=>{
 const previous=['ig','fb','tt'].flatMap(channelId=>
 Array.from({length:9},(_,i)=>({channelId,id:channelId+i,status:'scheduled',text:'other post'})));
 const m=mock({existing:previous});
 const r=await run({token:'SYNTHETIC',request:m.request,log:m.log});
 assert.equal(r.accepted,0);
});
