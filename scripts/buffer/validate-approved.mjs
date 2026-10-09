// Offline approval/format gate. Does not read any credentials or contact Buffer.
import { readFileSync } from 'node:fs';
import { validateManifest } from './queue-approved.mjs';

try {
  const manifest = JSON.parse(readFileSync('content/buffer/approved.json','utf8'));
  const campaigns = validateManifest(manifest);
  console.log('PASS: valid owner-approved campaign manifest; records=' + campaigns.length);
  if (campaigns.length === 0) {
    console.log('SAFE: empty approved manifest, automatic queue has nothing to post');
  }
} catch (error) {
  console.error('FAIL: approved manifest: ' + error.message);
  process.exitCode = 1;
}
