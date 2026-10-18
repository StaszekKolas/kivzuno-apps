import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, DEFAULT_SCORES, evaluate, shareText } from '../hub/dog-performance-review/game.mjs';

test('film preset matches all three film ratings and probation verdict', () => {
  const result = evaluate(DEFAULT_SCORES);
  assert.deepEqual(result.scores, { walks: 2, treats: 9, sofa: 1 });
  assert.equal(result.total, 12);
  assert.equal(result.max, 30);
  assert.equal(result.id, 'probation');
  assert.equal(result.weakest, 'sofa');
  assert.equal(result.strongest, 'treats');
});

test('verdicts cover all scores and boundaries deterministically', () => {
  assert.equal(evaluate({ walks: 0, treats: 0, sofa: 0 }).id, 'probation');
  assert.equal(evaluate({ walks: 5, treats: 5, sofa: 3 }).id, 'probation');
  assert.equal(evaluate({ walks: 5, treats: 5, sofa: 4 }).id, 'improvement');
  assert.equal(evaluate({ walks: 8, treats: 8, sofa: 7 }).id, 'improvement');
  assert.equal(evaluate({ walks: 8, treats: 8, sofa: 8 }).id, 'approved');
  assert.equal(evaluate({ walks: 10, treats: 10, sofa: 10 }).total, 30);
});

test('rejects missing, malformed, out-of-range, and non-integer values', () => {
  for (const bad of [null, {}, {walks: 1, treats: 5}, {walks: -1, treats: 5, sofa: 4},
    {walks: 11, treats: 5, sofa: 4}, {walks: '2', treats: 5, sofa: 4},
    {walks: 2.5, treats: 5, sofa: 4}, {walks: NaN, treats: 5, sofa: 4}]) {
    assert.throws(() => evaluate(bad));
  }
});

test('categorical labels and comments are available and safe', () => {
  assert.deepEqual(CATEGORIES.map(c => c.id), ['walks','treats','sofa']);
  const res = evaluate({ walks: 4, treats: 8, sofa: 6 });
  assert.equal(Object.keys(res.comments).length, 3);
  assert.ok(Object.values(res.comments).every(comment => comment.length > 10));
});

test('share has fixed secure URL and no pet names / private inputs', () => {
  const review = evaluate(DEFAULT_SCORES);
  const text = shareText(review,'https://kivzuno-hub.netlify.app/dog-performance-review/?src=tiktok#x');
  assert.ok(text.includes('12/30'));
  assert.ok(text.includes('ON PROBATION'));
  assert.ok(!text.includes('src='));
  assert.ok(!text.includes('#x'));
  assert.equal((text.match(/https:\/\/ /g)||[]).length,0);
  assert.ok(text.includes('https://kivzuno-hub.netlify.app/dog-performance-review/'));
  assert.throws(() => shareText(review,'http://example.com'));
  assert.throws(() => shareText(null));
});
