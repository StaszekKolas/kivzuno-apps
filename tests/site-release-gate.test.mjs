import test from 'node:test';
import assert from 'node:assert/strict';
import { readCurrentReleaseFiles, validateRelease } from '../scripts/site-release-gate.mjs';
import { checkLiveApp } from '../scripts/check-live-kivzuno.mjs';

const release = readCurrentReleaseFiles();

test('actual KIVZUNO source: playable route, metrics and Netlify settings consistent', () => {
  const result = validateRelease(release);
  assert.ok(result.appSlugs.includes('panic'));
  assert.ok(result.appSlugs.includes('battery'));
  assert.ok(result.trackedSources.includes('fb_reel'));
  assert.ok(result.trackedSources.includes('tiktok'));
});

test('rejects internal card that falls back to homepage', () => {
  const html = release.html.replace('else if(id==="panic")panic()', 'else if(id==="paniiic")panic()');
  assert.notEqual(html, release.html);
  assert.throws(() => validateRelease({ ...release, html }), /router branch/);
});

test('rejects game missing from server-side event allowlist', () => {
  const metrics = release.metrics.replace('"flag", "panic"', '"flag"');
  assert.notEqual(metrics, release.metrics);
  assert.throws(() => validateRelease({ ...release, metrics }), /not included in server metrics/);
});

test('rejects source accepted in browser but blocked by server', () => {
  const metrics = release.metrics.replace('"fb_reel", ', '');
  assert.notEqual(metrics, release.metrics);
  assert.throws(() => validateRelease({ ...release, metrics }), /rejected by metrics function|not tracked end to end/);
});

test('rejects broken inline JavaScript before release', () => {
  const html = release.html.replace('const visited=new Set();', 'const visited=;');
  assert.notEqual(html, release.html);
  assert.throws(() => validateRelease({ ...release, html }), /Unexpected token|SyntaxError/);
});

function mockPage(html, { status = 200, redirect = 'https://kivzuno-hub.netlify.app/' } = {}) {
  return async () => ({
    ok: status === 200,
    status,
    url: redirect,
    text: async () => html,
  });
}

test('public production probe recognizes deployed approved app', async () => {
  const messages = [];
  const result = await checkLiveApp('panic', {
    request: mockPage(release.html),
    log: text => messages.push(text),
  });
  assert.equal(result.url, 'https://kivzuno-hub.netlify.app/#panic');
  assert.ok(messages[0].startsWith('PASS:'));
});

test('public production probe refuses missing app', async () => {
  await assert.rejects(checkLiveApp('samebrain', { request: mockPage(release.html) }), /not deployed/);
});

test('public production probe refuses unexpected redirect and HTTP errors', async () => {
  await assert.rejects(checkLiveApp('panic', {
    request: mockPage(release.html, { redirect: 'https://not-kivzuno.invalid/' }),
  }), /Unexpected public site redirect/);
  await assert.rejects(checkLiveApp('panic', {
    request: mockPage(release.html, { status: 404 }),
  }), /HTTP 404/);
});

test('live probe rejects unknown slug without network access', async () => {
  await assert.rejects(checkLiveApp('unapproved', {
    request: async () => { throw new Error('should not fetch'); },
  }), /Unknown or unapproved/);
});
