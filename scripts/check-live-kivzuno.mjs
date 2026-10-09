// Check whether a specific app is present on the PUBLIC Netlify site.
// HTTP + code presence only: this is not an interactive browser playthrough.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

export const PUBLIC_SITE = 'https://kivzuno-hub.netlify.app/';
export const VALID_SLUGS = ['battery', 'flag', 'panic', 'premium', 'samebrain', 'lockin'];

export async function checkLiveApp(slug, { request = fetch, log = console.log } = {}) {
  if (!VALID_SLUGS.includes(slug)) {
    throw new Error('Unknown or unapproved app slug: ' + String(slug));
  }
  const url = new URL(PUBLIC_SITE);
  url.searchParams.set('release_check', Date.now().toString());
  const response = await request(url.toString(), {
    method: 'GET',
    redirect: 'follow',
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Live Netlify returned HTTP ' + response.status);
  const finalUrl = new URL(response.url || url.toString());
  if (finalUrl.hostname !== 'kivzuno-hub.netlify.app') {
    throw new Error('Unexpected public site redirect');
  }
  const html = await response.text();
  if (!html.includes('KIVZUNO')) throw new Error('Wrong site content');
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!script) throw new Error('No app JavaScript in live response');
  new Script(script[1]);
  const route = html.match(/^function route\(\)\{.*$/m)?.[0] || '';
  if (!html.includes('{href:"#' + slug + '"') ||
      !route.includes('id==="' + slug + '"')) {
    throw new Error('App #' + slug + ' not deployed in public homepage/router');
  }
  if (slug === 'samebrain' && !html.includes('function sameBrain()')) {
    throw new Error('Same Brain gameplay missing');
  }
  if (slug === 'lockin' && !html.includes('function lockIn()')) {
    throw new Error('Locked In gameplay missing');
  }
  if (slug === 'panic' && !html.includes('function panic()')) {
    throw new Error('Panic Button gameplay missing');
  }
  log('PASS: PUBLIC Netlify serves card/router for #' + slug);
  log('NOTE: Not a substitute for manual mobile gameplay/checkout testing.');
  return { slug, url: PUBLIC_SITE + '#' + slug };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkLiveApp(process.argv[2]).catch((error) => {
    console.error('FAIL: ' + error.message);
    process.exitCode = 1;
  });
}
