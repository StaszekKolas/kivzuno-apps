// User-approved one-time Pet Walk Report launch. No recurring schedule or payments.
// Fail closed if public demo, media, channel identity or Buffer history cannot be checked.
export const APP='https://kivzuno-hub.netlify.app/pet-walk-report/';
export const VIDEO='https://kivzuno-hub.netlify.app/media/pet-walk-report-promo-20261009.mp4';
const SERVICES=['instagram','facebook','tiktok'];
const STATUSES=['draft','error','needs_approval','scheduled','sending','sent'];
export const CAPTIONS={
  instagram:'🐾 DOG WALKERS: still typing the same updates after every walk?\n\nMeet Pet Walk Report by KIVZUNO. Turn walk details into a tidy PDF or WhatsApp-ready update — with a photo, no sign-up and no pet details uploaded.\n\nFree to try. Find KIVZUNO in our bio, then tap Pet Walk Report.\nhttps://kivzuno-hub.netlify.app/pet-walk-report/?src=ig_reel\n\n#KIVZUNO #PetWalkReport #DogWalkers #PetSitters #SmallBusinessTools',
  facebook:'🐾 Dog walkers & pet sitters: give every pet parent a neat walk update in under a minute.\n\nMeet Pet Walk Report from KIVZUNO — a FREE tool to create a walk summary, print a PDF and share the highlights via WhatsApp. Photos and notes stay in your browser. No account required.\n\nTry it free ➜ https://kivzuno-hub.netlify.app/pet-walk-report/?src=fb_reel\n\n#KIVZUNO #PetWalkReport #DogWalkers #PetSitters',
  tiktok:'POV: you are a dog walker sending the same update 8 times a day 🐾\n\nPet Walk Report by KIVZUNO: build a free PDF or WhatsApp walk summary, add a photo, no sign-up. Try it via KIVZUNO in bio.\nhttps://kivzuno-hub.netlify.app/pet-walk-report/?src=tiktok\n\n#KIVZUNO #PetWalkReport #DogWalkers #PetSitting #SmallBusiness'
};
const json=s=>JSON.stringify(s);
export async function run({
  token,request=fetch,log=console.log,app=APP,media=VIDEO,mode='publish'
}={}){
 if(!['inspect','publish'].includes(mode))throw Error('Invalid mode');
 if(!token)throw Error('BUFFER_API_KEY missing');
 if(app!==APP||media!==VIDEO)throw Error('Unapproved app/media');
 const check=await request(app+'?check=petreport-social-launch',{
   method:'GET',redirect:'follow',signal:AbortSignal.timeout(20000),
   headers:{'cache-control':'no-cache'}
 });
 if(!check.ok||new URL(check.url||app).hostname!=='kivzuno-hub.netlify.app')throw Error('Public app not available');
 const body=await check.text();
 if(!body.includes('Pet Walk Report')||!body.includes('id="report"')||
    !body.includes('Save / print PDF')||!body.includes('No payment'))throw Error('Public app is not approved version');
 const asset=await request(media,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(20000)});
 if(!asset.ok||!/^video\/mp4/i.test(asset.headers?.get('content-type')||''))throw Error('Public promo video not available');
 log('PASS: real app and promo MP4 are publicly accessible');
 async function api(query){
   const response=await request('https://api.buffer.com',{
     method:'POST',headers:{authorization:'Bearer '+token.trim(),'content-type':'application/json'},
     body:JSON.stringify({query}),signal:AbortSignal.timeout(20000)
   });
   if(!response.ok)throw Error('Buffer HTTP '+response.status);
   const x=await response.json();
   if(x.errors?.length||!x.data)throw Error('Buffer GraphQL error');
   return x.data;
 }
 const account=await api('query { account { organizations { id } } }');
 const orgs=account.account?.organizations;
 if(!Array.isArray(orgs)||!orgs.length)throw Error('No Buffer organization');
 const channels=[];
 for(const o of orgs){
   const x=await api('query { channels(input: { organizationId: '+json(o.id)+
     ' }) { id name displayName service isDisconnected isLocked } }');
   if(!Array.isArray(x.channels))throw Error('Buffer channels unavailable');
   channels.push(...x.channels.map(c=>({...c,orgId:o.id})));
 }
 const chosen={};
 for(const service of SERVICES){
   const hits=channels.filter(c=>c.service?.toLowerCase()===service);
   if(hits.length!==1||!hits[0].id||hits[0].isDisconnected||hits[0].isLocked||
      !/kivzuno/i.test((hits[0].name||'')+' '+(hits[0].displayName||'')))throw Error('Ambiguous '+service+' channel');
   chosen[service]=hits[0];
 }
 const history=[];
 for(const org of orgs){
   const cs=SERVICES.map(s=>chosen[s]).filter(c=>c.orgId===org.id);
   if(!cs.length)continue;
   let after=null;
   for(let p=0;p<30;p++){
     const q='query { posts(first: 100'+(after?', after: '+json(after):'')+
       ', input: { organizationId: '+json(org.id)+', filter: { status: ['+
       STATUSES.join(', ')+'], channelIds: ['+cs.map(c=>json(c.id)).join(',')+
       '] } }) { edges { node { id channelId text status } } pageInfo { hasNextPage endCursor } } }';
     const x=await api(q);
     if(!Array.isArray(x.posts?.edges)||!x.posts?.pageInfo)throw Error('Incomplete Buffer history');
     history.push(...x.posts.edges.map(e=>e.node));
     if(!x.posts.pageInfo.hasNextPage)break;
     if(!x.posts.pageInfo.endCursor||p===29)throw Error('Truncated Buffer history');
     after=x.posts.pageInfo.endCursor;
   }
 }
 const selected=[];
 const src={instagram:'ig_reel',facebook:'fb_reel',tiktok:'tiktok'};
 for(const service of SERVICES){
   const ch=chosen[service];
   const prior=history.find(p=>p.channelId===ch.id &&
     (p.text?.trim()===CAPTIONS[service].trim()||p.text?.includes('pet-walk-report/?src='+src[service])));
   if(prior){log(service+': SKIPPED (existing post '+prior.id+' '+prior.status+')');continue;}
   const queued=history.filter(p=>p.channelId===ch.id&&['scheduled','needs_approval','sending'].includes(p.status)).length;
   if(queued>=9){log(service+': SKIPPED (Buffer Free queue guard)');continue;}
   selected.push({service,ch});
 }
 if(mode==='inspect'){
   log('INSPECT ONLY: '+selected.length+' potential posts');
   return {accepted:0,pending:selected.length};
 }
 let accepted=0;
 for(const item of selected){
   const {service,ch}=item;
   const metadata=service==='instagram'
    ?'instagram: { type: reel, shouldShareToFeed: true, isAiGenerated: false }'
    :service==='facebook'?'facebook: { type: reel }':'tiktok: { isAiGenerated: false }';
   const mutation='mutation { createPost(input: { text: '+json(CAPTIONS[service])+
     ' channelId: '+json(ch.id)+' schedulingType: automatic mode: shareNow'+
     ' assets: [{ video: { url: '+json(media)+' } }] metadata: { '+metadata+
     ' } }) { __typename ... on PostActionSuccess { post { id status channelId } }'+
     ' ... on MutationError { message } } }';
   const result=(await api(mutation)).createPost;
   if(result?.__typename!=='PostActionSuccess'||!result.post?.id)throw Error(service+' submission failed; no automatic retry');
   accepted++;
   log(service+': ACCEPTED BY BUFFER id='+result.post.id+' status='+result.post.status);
 }
 log('DONE '+accepted+' Buffer submissions. Verify SENT separately.');
 return {accepted,pending:selected.length};
}
