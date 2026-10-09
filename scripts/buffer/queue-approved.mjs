// KIVZUNO: controlled Buffer Free queue. A CRON run never invents or approves content.
// One owner-approved manifest on main is the ONLY source of queue candidates.
// External HTTP calls: Buffer GraphQL, Netlify live read-only, approved media HEAD.
// Each write is createPost(mode: addToQueue). No purchases, deployment or paid features.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { checkLiveApp } from '../check-live-kivzuno.mjs';

const SERVICES = ['instagram', 'facebook', 'tiktok'];
const STATUS = ['draft', 'error', 'needs_approval', 'scheduled', 'sending', 'sent'];
const MEDIA_HOSTS = new Set(['static.metricool.com', 'kivzuno-hub.netlify.app']);
const MAX_SCHEDULED_PER_CHANNEL = 9; // Buffer Free officially allows 10; keep one spare.
const MAX_NEW_PER_CHANNEL_PER_RUN = 1;
const API = 'https://api.buffer.com';

const quote = (s) => JSON.stringify(s);
const validDate = (d) => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d) &&
  !Number.isNaN(Date.parse(d + 'T00:00:00Z'));

function checkedVideoUrl(raw) {
  if (typeof raw !== 'string') throw new Error('Invalid media URL');
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid media URL'); }
  if (url.protocol !== 'https:' || !MEDIA_HOSTS.has(url.hostname) || !url.pathname.endsWith('.mp4') ||
      url.username || url.password || url.port) {
    throw new Error('Media URL must be approved HTTPS MP4 host');
  }
  return url.toString();
}

export function validateManifest(input) {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.campaigns)) {
    throw new Error('Campaign manifest must have schemaVersion 1 and campaigns[]');
  }
  if (input.campaigns.length > 100) throw new Error('Campaign manifest exceeds safety cap');
  const seen = new Set();
  const campaigns = input.campaigns.map((c) => {
    if (!c || typeof c !== 'object' || !/^[a-z0-9][a-z0-9-]{7,72}$/.test(c.id || '') ||
        seen.has(c.id)) throw new Error('Duplicate or invalid campaign ID');
    seen.add(c.id);
    if (c.ownerApproved !== true || c.releaseVerified !== true ||
        typeof c.approvalPr !== 'string' ||
        !/^https:\/\/github\.com\/StaszekKolas\/kivzuno-apps\/pull\/\d+$/.test(c.approvalPr) ||
        typeof c.productionCommit !== 'string' || !/^[0-9a-f]{40}$/.test(c.productionCommit)) {
      throw new Error(c.id + ': owner PR approval and verified production SHA required');
    }
    if (!validDate(c.notBefore) || !validDate(c.notAfter) || c.notAfter < c.notBefore ||
        c.notAfter > '2028-12-31') throw new Error(c.id + ': invalid campaign dates');
    if (!['panic','battery','flag','samebrain','lockin'].includes(c.appSlug)) {
      throw new Error(c.id + ': cannot promote unverified app or premium checkout');
    }
    if (c.mediaType !== 'video') throw new Error(c.id + ': only reviewed video posts supported');
    if (typeof c.aiGenerated !== 'boolean') throw new Error(c.id + ': explicit AI disclosure required');
    if (!Array.isArray(c.services) || c.services.length !== 3 ||
        SERVICES.some((service) => !c.services.includes(service)) ||
        new Set(c.services).size !== 3) {
      throw new Error(c.id + ': exactly IG/FB/TikTok required');
    }
    if (!c.captions || !c.media || typeof c.captions !== 'object' || typeof c.media !== 'object') {
      throw new Error(c.id + ': missing content');
    }
    const expectedTag = { instagram:'ig_reel', facebook:'fb_reel', tiktok:'tiktok' };
    for (const service of SERVICES) {
      const caption = c.captions[service];
      const media = c.media[service];
      if (typeof caption !== 'string' || caption.length < 40 || caption.length > 1700 ||
          !caption.includes('#KIVZUNO') ||
          !caption.includes('https://kivzuno-hub.netlify.app/') ||
          !caption.includes('src=' + expectedTag[service]) ||
          !caption.includes('#' + c.appSlug)) {
        throw new Error(c.id + ': caption missing approved KIVZUNO destination for ' + service);
      }
      checkedVideoUrl(media);
    }
    return c;
  });
  return campaigns;
}

export function selectDue(campaigns, now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return campaigns.filter((c) => c.notBefore <= date && date <= c.notAfter)
    .sort((a,b) => a.notBefore.localeCompare(b.notBefore) || a.id.localeCompare(b.id));
}

export function loadManifest(path = 'content/buffer/approved.json') {
  return validateManifest(JSON.parse(readFileSync(path, 'utf8')));
}

export async function runQueue({
  manifest,
  token,
  request = fetch,
  liveCheck = checkLiveApp,
  now = new Date(),
  mode = 'inspect',
  log = console.log,
}) {
  if (!['inspect','queue'].includes(mode)) throw new Error('Invalid queue mode');
  const due = selectDue(validateManifest(manifest), now);
  if (due.length === 0) {
    log('NO APPROVED CAMPAIGNS DUE: nothing to submit');
    return { submitted: 0, eligible: 0 };
  }
  if (!token || !token.trim()) throw new Error('BUFFER_API_KEY secret missing');
  const secret = token.trim();

  async function graphql(query) {
    const response = await request(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error('Buffer returned HTTP ' + response.status);
    const parsed = await response.json();
    if (parsed?.errors?.length) throw new Error('Buffer GraphQL rejected query');
    if (!parsed?.data) throw new Error('Buffer returned no data');
    return parsed.data;
  }

  // Fail closed: only the three KIVZUNO social accounts, no other organizations.
  const account = await graphql('query { account { organizations { id } } }');
  const orgs = account.account?.organizations;
  if (!Array.isArray(orgs) || orgs.length === 0) throw new Error('Buffer organization unavailable');
  const channels = [];
  for (const org of orgs) {
    if (typeof org?.id !== 'string' || !org.id) throw new Error('Invalid organization');
    const d = await graphql('query { channels(input: { organizationId: ' +
      quote(org.id) + ' }) { id name displayName service isDisconnected isLocked } }');
    if (!Array.isArray(d.channels)) throw new Error('Buffer channel listing unavailable');
    for (const c of d.channels) {
      if (SERVICES.includes(c.service?.toLowerCase())) channels.push({ ...c, orgId: org.id });
    }
  }
  const selected = {};
  for (const service of SERVICES) {
    const matches = channels.filter((c) => c.service?.toLowerCase() === service);
    if (matches.length !== 1) throw new Error(service + ': ambiguous channel identity');
    const c = matches[0];
    if (!/kivzuno/i.test(String(c.name || '') + String(c.displayName || '')) ||
        c.isDisconnected || c.isLocked || typeof c.id !== 'string' || !c.id) {
      throw new Error(service + ': expected active KIVZUNO channel');
    }
    selected[service] = c;
  }

  // Fetch ALL pages and all statuses, including error/sending/sent, before any write.
  const posts = [];
  for (const org of orgs) {
    const orgChannels = SERVICES.map((s) => selected[s]).filter((c) => c.orgId === org.id);
    if (!orgChannels.length) continue;
    let after;
    for (let page = 0; page < 25; page++) {
      const args = 'first: 100' + (after ? ', after: ' + quote(after) : '');
      const d = await graphql('query { posts(' + args + ', input: {' +
        ' organizationId: ' + quote(org.id) +
        ' filter: { status: [' + STATUS.join(', ') + '], channelIds: [' +
        orgChannels.map((c) => quote(c.id)).join(',') + '] } }) {' +
        ' edges { node { id channelId text status } } pageInfo { hasNextPage endCursor } } }');
      if (!Array.isArray(d.posts?.edges) || !d.posts?.pageInfo) {
        throw new Error('Cannot verify Buffer history — no posts created');
      }
      posts.push(...d.posts.edges.map((x) => x.node));
      if (!d.posts.pageInfo.hasNextPage) break;
      after = d.posts.pageInfo.endCursor;
      if (!after || page === 24) throw new Error('Buffer history truncated — no posts created');
    }
  }

  // One new item PER platform per run. Never requeue any caption already in ANY status.
  const pending = [];
  for (const service of SERVICES) {
    const channel = selected[service];
    const queueCount = posts.filter((p) =>
      p?.channelId === channel.id && ['scheduled','needs_approval','sending'].includes(p.status)).length;
    if (queueCount >= MAX_SCHEDULED_PER_CHANNEL) {
      log(service + ': queue guard, ' + queueCount + ' pending; SKIPPED');
      continue;
    }
    const candidates = due.filter((campaign) => !posts.some((p) =>
      p?.channelId === channel.id && p.text?.trim() === campaign.captions[service].trim()));
    const chosen = candidates.slice(0, MAX_NEW_PER_CHANNEL_PER_RUN);
    if (!chosen.length) {
      log(service + ': no unseen approved caption; SKIPPED');
      continue;
    }
    const campaign = chosen[0];
    log(service + ': approved candidate ' + campaign.id);
    pending.push({ channel, campaign, service });
  }
  if (mode === 'inspect') {
    log('INSPECT ONLY; no Buffer posts created');
    return { submitted: 0, eligible: pending.length };
  }
  if (pending.length === 0) return { submitted: 0, eligible: 0 };

  // Every unique app must be LIVE on Netlify. Manual gameplay proof is separately
  // required by the ownerApproved + releaseVerified PR process.
  const checkedApps = new Set();
  for (const item of pending) {
    if (!checkedApps.has(item.campaign.appSlug)) {
      await liveCheck(item.campaign.appSlug, { request, log: () => {} });
      checkedApps.add(item.campaign.appSlug);
    }
  }
  // Check all media before first write. Restricted to trusted, public MP4 hosts.
  for (const item of pending) {
    const url = checkedVideoUrl(item.campaign.media[item.service]);
    const response = await request(url, {
      method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(item.service + ': approved media not accessible');
    const mime = response.headers?.get?.('content-type') || '';
    if (!/^(video\/|application\/octet-stream)/i.test(mime)) {
      throw new Error(item.service + ': wrong media content type');
    }
  }
  let submitted = 0;
  for (const item of pending) {
    const { channel, campaign, service } = item;
    const meta = service === 'instagram'
      ? 'instagram: { type: reel, shouldShareToFeed: true, isAiGenerated: ' + campaign.aiGenerated + ' }'
      : service === 'facebook' ? 'facebook: { type: reel }'
      : 'tiktok: { isAiGenerated: ' + campaign.aiGenerated + ' }';
    const mutation = 'mutation { createPost(input: {' +
      ' text: ' + quote(campaign.captions[service]) +
      ' channelId: ' + quote(channel.id) +
      ' schedulingType: automatic mode: addToQueue' +
      ' assets: [{ video: { url: ' + quote(campaign.media[service]) + ' } }]' +
      ' metadata: { ' + meta + ' }' +
      ' }) { __typename ... on PostActionSuccess { post { id status dueAt channelId } }' +
      ' ... on MutationError { message } } }';
    const data = await graphql(mutation);
    if (data.createPost?.__typename !== 'PostActionSuccess' ||
        !data.createPost.post?.id) {
      throw new Error(service + ': Buffer declined creation (check supported free metadata)');
    }
    const result = data.createPost.post;
    submitted++;
    log(service + ': QUEUED ' + campaign.id + ' postId=' + result.id +
      ' status=' + result.status + ' dueAt=' + (result.dueAt || 'Buffer queue'));
  }
  log('ACCEPTED: ' + submitted + ' queued posts; publication requires subsequent Buffer status SENT');
  return { submitted, eligible: pending.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.env.KIVZUNO_BUFFER_MODE || 'inspect';
  // An explicit repository variable is REQUIRED to enable writes; a missing
  // variable, missing manifest, or unapproved content cannot enable publishing.
  if (mode === 'queue' && process.env.BUFFER_AUTOPUBLISH_ENABLED !== 'true') {
    console.error('STOP: GitHub repository variable BUFFER_AUTOPUBLISH_ENABLED is not true');
    process.exitCode = 1;
  } else {
    runQueue({ manifest: JSON.parse(readFileSync('content/buffer/approved.json','utf8')),
      token: process.env.BUFFER_API_KEY, mode }).catch((error) => {
      console.error('FAIL: ' + error.message);
      process.exitCode = 1;
    });
  }
}
