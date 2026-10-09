// Static, dependency-free KIVZUNO pre-release validation.
// This checks source consistency. It does NOT prove runtime gameplay or production deployment.
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REQUIRED_CAMPAIGN_SOURCES = ['ig_reel', 'fb_reel', 'tiktok'];

function jsonArray(source, regex, label) {
  const match = source.match(regex);
  if (!match) throw new Error(label + ': allowlist not found');
  let values;
  try { values = JSON.parse(match[1]); }
  catch { throw new Error(label + ': allowlist invalid'); }
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) {
    throw new Error(label + ': expected array of strings');
  }
  return values;
}

export function validateRelease({ html, metrics, netlifyConfig }) {
  if (typeof html !== 'string' || !html.includes('KIVZUNO')) {
    throw new Error('Missing KIVZUNO homepage');
  }
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!script) throw new Error('Missing playable homepage JavaScript');
  new Script(script[1], { filename: 'hub/index.html' }); // Syntax only. Does not execute.
  const route = html.match(/^function route\(\)\{.*$/m)?.[0];
  if (!route) throw new Error('Missing app router');

  const appSlugs = [...html.matchAll(/\{href:"#([a-z][a-z0-9_-]*)"/g)]
    .map((match) => match[1]);
  if (appSlugs.length === 0 || new Set(appSlugs).size !== appSlugs.length) {
    throw new Error('Missing or duplicated miniapp card');
  }
  const serverApps = jsonArray(metrics, /const apps\s*=\s*(\[[^;\n]+\]);/, 'Metric app');
  const serverSources = jsonArray(metrics, /const sources\s*=\s*(\[[^;\n]+\]);/, 'Metric source');
  const clientSources = jsonArray(html, /const source\s*=\s*(\[[^;\n]+\])\.includes\(sourceParam\)/, 'Client source');

  if (!serverApps.includes('home')) throw new Error('Missing home metric');
  for (const slug of appSlugs) {
    if (!route.includes('id==="' + slug + '"')) {
      throw new Error('App card #' + slug + ' has no working router branch');
    }
    if (!serverApps.includes(slug)) {
      throw new Error('App #' + slug + ' not included in server metrics allowlist');
    }
  }
  for (const source of clientSources) {
    if (!serverSources.includes(source)) {
      throw new Error('Client source "' + source + '" rejected by metrics function');
    }
  }
  for (const source of REQUIRED_CAMPAIGN_SOURCES) {
    if (!clientSources.includes(source) || !serverSources.includes(source)) {
      throw new Error('Approved campaign source "' + source + '" not tracked end to end');
    }
  }
  if (!/publish\s*=\s*"hub"/.test(netlifyConfig) ||
      !/directory\s*=\s*"netlify\/functions"/.test(netlifyConfig)) {
    throw new Error('Unexpected Netlify hub/functions build configuration');
  }
  return { appSlugs, trackedSources: clientSources };
}

export function readCurrentReleaseFiles(root = process.cwd()) {
  const read = (path) => readFileSync(resolve(root, path), 'utf8');
  return {
    html: read('hub/index.html'),
    metrics: read('netlify/functions/metrics.mjs'),
    netlifyConfig: read('netlify.toml'),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateRelease(readCurrentReleaseFiles());
    console.log('PASS: KIVZUNO source-release gate (' + result.appSlugs.join(', ') + ')');
    console.log('PASS: tracked marketing sources (' + result.trackedSources.join(', ') + ')');
    console.log('NOTE: Source validation is not proof of public Netlify deployment.');
  } catch (error) {
    console.error('FAIL: ' + error.message);
    process.exitCode = 1;
  }
}
