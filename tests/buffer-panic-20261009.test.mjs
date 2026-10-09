import test from 'node:test';
import assert from 'node:assert/strict';
import { runCampaign, CAMPAIGN } from '../scripts/buffer/publish-panic-20261009.mjs';

const today = new Date('2026-10-09T16:00:00Z');
function harness({ existing = [], badMedia = false } = {}) {
  const queries = [];
  const logs = [];
  const request = async (url, opts) => {
    if (opts.method === 'HEAD') {
      if (badMedia) return { ok: false, status: 404, headers: new Map() };
      return { ok: true, status: 200, headers: new Map([['content-type', 'video/mp4']]) };
    }
    const query = JSON.parse(opts.body).query;
    queries.push(query);
    let data;
    if (query.includes('GetOrganizations')) data = { account: { organizations: [{ id: 'org1' }] } };
    else if (query.includes('GetChannels')) data = { channels: [
      { id: 'ig1', service: 'instagram', name: 'kivzuno', isDisconnected: false, isLocked: false },
      { id: 'fb1', service: 'facebook', name: 'Kivzuno', isDisconnected: false, isLocked: false },
      { id: 'tt1', service: 'tiktok', name: '.kivzuno', isDisconnected: false, isLocked: false },
    ] };
    else if (query.includes('GetPosts')) data = { posts: {
      edges: existing.map((x) => ({ node: x })),
      pageInfo: { hasNextPage: false, endCursor: null },
    } };
    else if (query.includes('CreateApprovedPost')) data = { createPost: {
      __typename: 'PostActionSuccess', post: {
        id: 'new-' + queries.length, status: 'sending', channelId: 'ig1',
      },
    } };
    else throw new Error('Unknown query');
    return { ok: true, status: 200, json: async () => ({ data }) };
  };
  return { request, queries, logs, log: (line) => logs.push(line) };
}
test('retries ONLY Facebook/TikTok; Instagram never re-submitted', async () => {
  const mock = harness();
  const result = await runCampaign({ token: 'synthetic-test-token', request: mock.request, log: mock.log, now: today });
  assert.equal(result.created, 2);
  const mutations = mock.queries.filter((q) => q.includes('mutation CreateApprovedPost'));
  assert.equal(mutations.length, 2);
  assert.ok(mutations.every((q) => q.includes('mode: shareNow') && q.includes('video: { url:')));
  assert.ok(mutations.every((q) => !q.includes('instagram: {')));
  assert.ok(mock.logs.some((l) => l.includes('instagram: NOT RETRIED')));
  assert.ok(mutations.some((q) => q.includes('facebook: { type: reel')));
  assert.ok(mutations.every((q) => !q.includes('firstComment')));
  assert.ok(mock.queries.some((q) => q.includes('status: [draft, error, needs_approval, scheduled, sending, sent]')));
  assert.ok(mutations.some((q) => q.includes('tiktok: { isAiGenerated: true')));
  assert.ok(mock.logs.every((l) => !l.includes('synthetic-test-token')));
});
test('prevents duplicate caption on its exact channel', async () => {
  const mock = harness({ existing: [{ id: 'prior', channelId: 'fb1', text: CAMPAIGN[1].text, status: 'sending' }] });
  const result = await runCampaign({ token: 'synthetic-test-token', request: mock.request, log: mock.log, now: today });
  assert.equal(result.created, 1);
  assert.ok(mock.logs.some((l) => l.includes('facebook: SKIPPED')));
});
test('unavailable media aborts before any mutation', async () => {
  const mock = harness({ badMedia: true });
  await assert.rejects(
    runCampaign({ token: 'synthetic-test-token', request: mock.request, log: mock.log, now: today }),
    /media URL unavailable/,
  );
  assert.equal(mock.queries.filter((q) => q.includes('mutation')).length, 0);
});
test('wrong date fails before any network request', async () => {
  const mock = harness();
  await assert.rejects(
    runCampaign({ token: 'synthetic-test-token', request: mock.request, log: mock.log, now: new Date('2026-10-10T12:00:00Z') }),
    /only authorized for 2026-10-09/,
  );
  assert.equal(mock.queries.length, 0);
});
test('inspect mode never mutates', async () => {
  const mock = harness();
  const result = await runCampaign({ token: 'synthetic-test-token', request: mock.request, log: mock.log, now: today, mode: 'inspect' });
  assert.equal(result.created, 0);
  assert.equal(result.remaining, 2);
  assert.equal(mock.queries.filter((q) => q.includes('mutation')).length, 0);
});
