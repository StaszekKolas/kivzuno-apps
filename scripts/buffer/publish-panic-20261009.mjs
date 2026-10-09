// One-time KIVZUNO campaign, approved for 2026-10-09 (Europe/London).
// Fail closed: no automatic runs; verify Buffer history & media before posting.
// Uses GitHub Actions secret only, never embeds the API key in the repository.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const CAMPAIGN = Object.freeze([
  {
    service: 'instagram',
    text: '🚨 ADULTING EMERGENCY?\n\nChoose your crisis. Press PANIC. Receive a deeply questionable solution. 😂\n\nTry Panic Button for Adults — free, no login:\nhttps://kivzuno-hub.netlify.app/?src=ig_reel#panic\n\n#KIVZUNO #PanicButtonForAdults #AdultingHumor #MiniApps #JustForFun',
    media: 'https://static.metricool.com/planner/202610/7218358-file-5496669344276078592.mp4',
    metadata: 'instagram: { type: reel, shouldShareToFeed: true, isAiGenerated: true }',
  },
  {
    service: 'facebook',
    text: '🚨 ADULTING EMERGENCY?\n\nChoose your crisis. Press PANIC. Receive a deeply questionable solution. 😂\n\nTry Panic Button for Adults — free, no login:\nhttps://kivzuno-hub.netlify.app/?src=fb_reel#panic\n\n#KIVZUNO #PanicButtonForAdults #AdultingHumor #MiniApps',
    media: 'https://static.metricool.com/planner/202610/7218358-file-9829500710376318212.mp4',
    metadata: 'facebook: { type: reel }',
  },
  {
    service: 'tiktok',
    text: 'ADULTING EMERGENCY? 🚨\n\nChoose your crisis. Press PANIC. Get a deeply questionable solution.\n\nPlay free via the KIVZUNO link in our profile.\nhttps://kivzuno-hub.netlify.app/?src=tiktok#panic\n\n#KIVZUNO #PanicButtonForAdults #AdultingHumor #MiniApps',
    media: 'https://static.metricool.com/planner/202610/7218358-file-16612590983388113838.mp4',
    metadata: 'tiktok: { isAiGenerated: true }',
  },
]);

function requireToday(now) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  if (date !== '2026-10-09') throw new Error('STOP: only authorized for 2026-10-09 UK; today=' + date);
}

function quoted(value) { return JSON.stringify(value); }

export async function runCampaign({
  token,
  request = fetch,
  log = console.log,
  now = new Date(),
  mode = 'publish',
}) {
  requireToday(now);
  if (!token || !token.trim()) throw new Error('BUFFER_API_KEY GitHub secret missing');
  if (!['publish', 'inspect'].includes(mode)) throw new Error('Unknown mode');
  const auth = token.trim();

  async function graphql(query) {
    const response = await request('https://api.buffer.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + auth,
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Buffer HTTP ' + response.status);
    const json = await response.json();
    if (json.errors?.length) throw new Error('Buffer GraphQL error (' + json.errors.length + ')');
    if (!json.data) throw new Error('Buffer response missing data');
    return json.data;
  }

  const account = await graphql('query GetOrganizations { account { organizations { id } } }');
  const orgs = account.account?.organizations;
  if (!Array.isArray(orgs) || orgs.length === 0) throw new Error('Buffer organizations unavailable');

  const channels = [];
  for (const org of orgs) {
    if (typeof org.id !== 'string' || !org.id) throw new Error('Invalid Buffer organization');
    const data = await graphql('query GetChannels { channels(input: { organizationId: ' +
      quoted(org.id) + ' }) { id name displayName service isDisconnected isLocked } }');
    if (!Array.isArray(data.channels)) throw new Error('Buffer channels unavailable');
    for (const channel of data.channels) channels.push({ ...channel, orgId: org.id });
  }

  const selected = [];
  for (const post of CAMPAIGN) {
    const matches = channels.filter((c) => c.service?.toLowerCase() === post.service);
    if (matches.length !== 1) throw new Error(post.service + ': expected exactly one linked channel, got ' + matches.length);
    const channel = matches[0];
    const identity = String(channel.name || '') + ' ' + String(channel.displayName || '');
    if (!/kivzuno/i.test(identity)) {
      throw new Error(post.service + ': connected channel identity does not match KIVZUNO');
    }
    if (channel.isDisconnected || channel.isLocked) throw new Error(post.service + ': channel disconnected or locked');
    if (typeof channel.id !== 'string' || !channel.id) throw new Error(post.service + ': invalid channel ID');
    selected.push({ ...post, channel });
  }

  const history = [];
  for (const org of orgs) {
    if (!selected.some((p) => p.channel.orgId === org.id)) continue;
    let after;
    for (let page = 0; page < 20; page++) {
      const next = after ? ', after: ' + quoted(after) : '';
      const data = await graphql('query GetPosts { posts(first: 100' + next +
        ', input: { organizationId: ' + quoted(org.id) +
        ', filter: { status: [draft, error, needs_approval, scheduled, sending, sent], channelIds: [' + selected.filter((p) => p.channel.orgId === org.id)
          .map((p) => quoted(p.channel.id)).join(',') + '] } }) {' +
        ' edges { node { id text channelId status createdAt dueAt } }' +
        ' pageInfo { hasNextPage endCursor } } }');
      if (!Array.isArray(data.posts?.edges) || !data.posts?.pageInfo) {
        throw new Error('Buffer history unavailable; refusing to create any posts');
      }
      history.push(...data.posts.edges.map((edge) => edge.node));
      if (!data.posts.pageInfo.hasNextPage) break;
      after = data.posts.pageInfo.endCursor;
      if (!after || page === 19) throw new Error('Cannot exhaust Buffer history pages; refusing posts');
    }
  }

  const pending = [];
  for (const post of selected) {
    // A previous actual API attempt accepted Instagram at 14:41 UTC.
    // Never re-submit this campaign to IG, irrespective of its later status.
    // Even error status needs separate manual review: no automatic duplicate.
    if (post.service === 'instagram') {
      log('instagram: NOT RETRIED (accepted in run 37946005504; Buffer post 6ac8fd0a443de896598070b7)');
      continue;
    }
    // Exact approved caption comparison; ANY matching previous status blocks duplicates.
    const duplicate = history.find((h) =>
      h?.channelId === post.channel.id && h?.text?.trim() === post.text.trim());
    if (duplicate) {
      log(post.service + ': SKIPPED (existing Buffer post: ' + duplicate.status + ', id ' + duplicate.id + ')');
    } else {
      pending.push(post);
    }
  }

  if (mode === 'inspect') {
    for (const post of pending) log(post.service + ': READY FOR PRE-FLIGHT');
    log('INSPECT ONLY: no posts created');
    return { created: 0, remaining: pending.length };
  }

  // Preflight ALL pending videos first. No partial uploads due to broken media.
  for (const post of pending) {
    const response = await request(post.media, {
      method: 'HEAD', redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(post.service + ': media URL unavailable, HTTP ' + response.status);
    const contentType = response.headers?.get?.('content-type') || '';
    if (!(/video\/|application\/octet-stream/i.test(contentType))) {
      throw new Error(post.service + ': unexpected media type ' + contentType);
    }
    log(post.service + ': media preflight PASS');
  }

  let created = 0;
  for (const post of pending) {
    const mutation = 'mutation CreateApprovedPost { createPost(input: {' +
      'text: ' + quoted(post.text) +
      ' channelId: ' + quoted(post.channel.id) +
      ' schedulingType: automatic mode: shareNow' +
      ' assets: [{ video: { url: ' + quoted(post.media) + ' } }]' +
      ' metadata: {' + post.metadata + '}' +
      ' }) { __typename ... on PostActionSuccess { post { id status channelId } }' +
      ' ... on MutationError { message } } }';
    const data = await graphql(mutation);
    if (data.createPost?.__typename !== 'PostActionSuccess' || !data.createPost?.post?.id) {
      throw new Error(post.service + ': createPost rejected' +
        (data.createPost?.message ? ': ' + String(data.createPost.message).slice(0,150) : ''));
    }
    created++;
    const result = data.createPost.post;
    log(post.service + ': ACCEPTED BY BUFFER, id=' + result.id + ', status=' + result.status);
  }
  log('DONE: ' + created + ' submissions accepted by Buffer. Check SENT status in Buffer for actual publication.');
  return { created, remaining: 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCampaign({
    token: process.env.BUFFER_API_KEY,
    mode: process.env.BUFFER_CAMPAIGN_MODE || 'publish',
  }).catch((error) => {
    console.error('FAIL: ' + error.message);
    process.exitCode = 1;
  });
}
