import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const m=JSON.parse(readFileSync(new URL('../content/corporate-chaos/s01e05-the-urgent-ticket.json',import.meta.url),'utf8'));
test('S01E05 continues the established three-season arc',()=>{assert.equal(m.season,1);assert.equal(m.episode,5);assert.match(m.previous,/S01E04/);assert.match(m.next,/S01E06/);});
test('9:16 format, 23 seconds, one original soundtrack, no voiceover',()=>{assert.deepEqual([m.format.width,m.format.height,m.format.fps,m.format.durationSeconds,m.format.audioChannels,m.format.voiceover],[720,1280,24,23,1,false]);});
test('seven ordered contiguous scenes and English captions',()=>{assert.equal(m.scenes.length,7);assert.equal(m.scenes[0].start,0);assert.equal(m.scenes.at(-1).end,23);for(let i=0;i<m.scenes.length-1;i++)assert.equal(m.scenes[i].end,m.scenes[i+1].start);for(const s of m.scenes){assert.ok(s.end>s.start);assert.ok(s.caption.length>4);}});
test('character, rights, cost and owner release gate',()=>{assert.match(m.character,/white.*black.*cyan.*KIV/i);assert.match(m.assets.font,/OFL/);assert.match(m.assets.audio,/Original/);assert.match(m.assets.watermark,/lower-right/);assert.equal(m.costGBP,0);assert.match(m.release,/HOLD/);});
test('publishing order is assessed independently per platform',()=>{assert.equal(m.platforms.instagram.lastEpisode,'S01E04');assert.equal(m.platforms.facebook.lastEpisode,'S01E03');assert.equal(m.platforms.tiktok.lastEpisode,'S01E03');for(const p of Object.values(m.platforms))assert.match(p.nextSuggested,/miniapp/);});
