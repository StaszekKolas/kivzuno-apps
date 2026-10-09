import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, selectDue, runQueue } from '../scripts/buffer/queue-approved.mjs';

const now = new Date('2026-10-15T12:00:00Z');
const textFor = (service) => {
  const sources = { instagram:'ig_reel', facebook:'fb_reel', tiktok:'tiktok' };
  return 'Approved KIVZUNO funny video for grownups 🚨 Free no login. https://kivzuno-hub.netlify.app/?src=' +
    sources[service] + '#panic #KIVZUNO #PanicButtonForAdults';
};
function campaign(overrides = {}) {
  return {
    id:'2026-10-15-panic-video-v2',
    ownerApproved:true,
    approvalPr:'https://github.com/StaszekKolas/kivzuno-apps/pull/100',
    releaseVerified:true,
    productionCommit:'edbde2c45829d1d07ff41b481d006de0d88804eb',
    appSlug:'panic',
    notBefore:'2026-10-15',
    notAfter:'2026-10-20',
    mediaType:'video',aiGenerated:true,
    services:['instagram','facebook','tiktok'],
    captions:{
      instagram:textFor('instagram'),
      facebook:textFor('facebook'),
      tiktok:textFor('tiktok'),
    },
    media:{
      instagram:'https://static.metricool.com/approved-instagram.mp4',
      facebook:'https://static.metricool.com/approved-facebook.mp4',
      tiktok:'https://static.metricool.com/approved-tiktok.mp4',
    }, ...overrides,
  };
}

function harness({ previous = [], badMedia = false, apiError = false } = {}) {
  const calls = [], logs = [];
  let liveCount = 0, mediaCount = 0;
  const request = async (url, opts) => {
    if (opts.method === 'HEAD') {
      mediaCount++;
      return { ok: !badMedia, status: badMedia ? 404 : 200,
        headers: new Map([['content-type','video/mp4']]) };
    }
    assert.equal(url, 'https://api.buffer.com');
    assert.equal(opts.headers.Authorization, 'Bearer fake-unit-test');
    const query = JSON.parse(opts.body).query;
    calls.push(query);
    let data;
    if (query.includes('account { organizations')) {
      data = { account: { organizations: [{ id: 'test-org' }] } };
    } else if (query.includes('channels(input:')) {
      data = { channels: [
        { id:'ch-ig',name:'kivzuno',service:'instagram' },
        { id:'ch-fb',name:'Kivzuno',service:'facebook' },
        { id:'ch-tt',name:'.kivzuno',service:'tiktok' },
      ] };
    } else if (query.includes('posts(first:')) {
      data = { posts: { edges:previous.map((p) => ({ node:p })),
        pageInfo: { hasNextPage:false,endCursor:null } } };
    } else if (query.includes('mutation')) {
      data = { createPost:apiError
        ? { __typename:'MutationError', message:'REQUIRES PAID PLAN' }
        : { __typename:'PostActionSuccess', post:{
          id:'new-' + calls.length,status:'scheduled',dueAt:'2026-10-16T12:00:00Z',channelId:'ch-ig',
        } } };
    } else throw new Error('Unrecognized query');
    return { ok:true, json:async()=>({ data }) };
  };
  return { request, calls, logs, get liveCount(){return liveCount;},
    get mediaCount(){return mediaCount;}, log:(x)=>logs.push(x),
    liveCheck: async (slug) => {
      assert.equal(slug,'panic'); liveCount++;
    } };
}

test('empty manifest cannot create any posts, even in queue mode', async () => {
  const mock = harness();
  const result = await runQueue({manifest:{schemaVersion:1,campaigns:[]},mode:'queue',
    request:mock.request,liveCheck:mock.liveCheck,now,log:mock.log});
  assert.equal(result.submitted,0);
  assert.equal(mock.calls.length,0);
});

test('unapproved campaign is blocked before any remote request', async () => {
  const mock = harness();
  await assert.rejects(runQueue({manifest:{schemaVersion:1,campaigns:[campaign({ownerApproved:false})]},
    mode:'queue',token:'fake-unit-test',request:mock.request,now}),/owner PR approval/);
  assert.equal(mock.calls.length,0);
});

test('deployment not verified and unknown app blocked', () => {
  assert.throws(() => validateManifest({schemaVersion:1,campaigns:[campaign({releaseVerified:false})]}),/owner PR approval/);
  assert.throws(() => validateManifest({schemaVersion:1,campaigns:[campaign({appSlug:'premium'})]}),/cannot promote/);
});

test('date window & duplicate campaign IDs fail closed', () => {
  assert.equal(selectDue([campaign()], new Date('2026-10-14T12:00:00Z')).length,0);
  assert.equal(selectDue([campaign()], new Date('2026-10-15T12:00:00Z')).length,1);
  assert.throws(()=>validateManifest({schemaVersion:1,campaigns:[campaign(),campaign()]}),/Duplicate/);
});

test('only trusted HTTPS MP4 media and correct source tags', () => {
  const c = campaign();
  c.media.instagram='http://static.metricool.com/file.mp4';
  assert.throws(()=>validateManifest({schemaVersion:1,campaigns:[c]}),/HTTPS MP4/);
  const m=campaign();
  m.captions.tiktok='Exciting post #KIVZUNO https://kivzuno-hub.netlify.app/#panic';
  assert.throws(()=>validateManifest({schemaVersion:1,campaigns:[m]}),/caption missing/);
});

test('inspect mode does not publish or download video', async () => {
  const mock = harness();
  const result = await runQueue({manifest:{schemaVersion:1,campaigns:[campaign()]},
    token:'fake-unit-test',request:mock.request,liveCheck:mock.liveCheck,mode:'inspect',now,log:mock.log});
  assert.equal(result.eligible,3);
  assert.equal(mock.calls.filter(q=>q.includes('mutation')).length,0);
  assert.equal(mock.mediaCount,0);
});

test('queue approved campaign once per social profile without paid features', async () => {
  const mock = harness();
  const result = await runQueue({manifest:{schemaVersion:1,campaigns:[campaign()]},
    token:'fake-unit-test',request:mock.request,liveCheck:mock.liveCheck,mode:'queue',now,log:mock.log});
  assert.equal(result.submitted,3);
  assert.equal(mock.liveCount,1);
  assert.equal(mock.mediaCount,3);
  const mutations=mock.calls.filter(q=>q.includes('mutation'));
  assert.equal(mutations.length,3);
  assert.ok(mutations.every(q=>q.includes('mode: addToQueue')));
  assert.ok(mutations.every(q=>!q.includes('firstComment') && !q.includes('shareNow')));
  assert.ok(mock.logs.every(x=>!x.includes('fake-unit-test')));
});

test('one existing FB caption in sending state is never duplicated', async () => {
  const mock = harness({previous:[{id:'existing',text:textFor('facebook'),channelId:'ch-fb',status:'sending'}]});
  const result=await runQueue({manifest:{schemaVersion:1,campaigns:[campaign()]},
    token:'fake-unit-test',request:mock.request,liveCheck:mock.liveCheck,mode:'queue',now,log:mock.log});
  assert.equal(result.submitted,2);
});

test('free queue guard blocks posting when 9 already scheduled on each channel', async () => {
  const ids=['ch-ig','ch-fb','ch-tt'];
  const previous=ids.flatMap(ch => Array.from({length:9},(_,i)=>({
    id:'post-'+ch+'-'+i,text:'old queued '+i,channelId:ch,status:'scheduled',
  })));
  const mock=harness({previous});
  const result=await runQueue({manifest:{schemaVersion:1,campaigns:[campaign()]},
    token:'fake-unit-test',request:mock.request,liveCheck:mock.liveCheck,mode:'queue',now,log:mock.log});
  assert.equal(result.submitted,0);
  assert.equal(mock.calls.filter(q=>q.includes('mutation')).length,0);
});

test('missing media stops before the first mutation, even after Buffer read succeeds',async()=>{
  const mock=harness({badMedia:true});
  await assert.rejects(runQueue({manifest:{schemaVersion:1,campaigns:[campaign()]},
    token:'fake-unit-test',request:mock.request,liveCheck:mock.liveCheck,mode:'queue',now,log:mock.log}),
    /approved media not accessible/);
  assert.equal(mock.calls.filter(q=>q.includes('mutation')).length,0);
});

test('failed public verification stops without posting',async()=>{
  const mock=harness();
  await assert.rejects(runQueue({manifest:{schemaVersion:1,campaigns:[campaign()]},
    token:'fake-unit-test',request:mock.request,liveCheck:async()=>{throw Error('not yet deployed');},
    mode:'queue',now,log:mock.log}),/not yet deployed/);
  assert.equal(mock.calls.filter(q=>q.includes('mutation')).length,0);
});

test('API rejection aborts rather than upgrading Buffer plan',async()=>{
  const mock=harness({apiError:true});
  await assert.rejects(runQueue({manifest:{schemaVersion:1,campaigns:[campaign()]},
    token:'fake-unit-test',request:mock.request,liveCheck:mock.liveCheck,mode:'queue',now,log:mock.log}),
    /Buffer declined creation/);
  assert.equal(mock.calls.filter(q=>q.includes('mutation')).length,1);
});
