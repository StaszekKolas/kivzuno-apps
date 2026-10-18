/**
 * KIVZUNO Dog Performance Review.
 * Local, deterministic comedy only. No API, accounts, tracking or uploads.
 */
export const CATEGORIES = Object.freeze([
  Object.freeze({ id: 'walks', label: 'Walks', emoji: '🦮' }),
  Object.freeze({ id: 'treats', label: 'Treats', emoji: '🦴' }),
  Object.freeze({ id: 'sofa', label: 'Sofa sharing', emoji: '🛋️' })
]);

const COMMENTS = Object.freeze({
  walks: Object.freeze([
    'My legs are ready. Your excuses are not.',
    'The walk schedule requires urgent renegotiation.',
    'Acceptable outdoor operations. Continue improvement.',
    'Excellent walkies. Please clock in again tomorrow.'
  ]),
  treats: Object.freeze([
    'I have reported the treat shortage to management.',
    'Treat distribution is inconsistent. I expect biscuits.',
    'Promising snack strategy. Stay focused.',
    'Exceptional biscuit leadership. No notes.'
  ]),
  sofa: Object.freeze([
    'My sofa. Your rent. We need to talk.',
    'Cushion access remains deeply concerning.',
    'Shared seating arrangements show progress.',
    'A truly premium sofa allocation. Carry on.'
  ])
});

export const DEFAULT_SCORES = Object.freeze({ walks: 2, treats: 9, sofa: 1 });

function commentIndex(score) {
  if (score <= 2) return 0;
  if (score <= 5) return 1;
  if (score <= 8) return 2;
  return 3;
}

export function evaluate(scores) {
  if (!scores || typeof scores !== 'object') throw new TypeError('Missing scores');
  const values = {};
  for (const { id } of CATEGORIES) {
    const value = scores[id];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10) {
      throw new RangeError(id + ' must be an integer between 0 and 10');
    }
    values[id] = value;
  }
  const total = values.walks + values.treats + values.sofa;
  const strongest = CATEGORIES.reduce((top, c) => values[c.id] > values[top.id] ? c : top, CATEGORIES[0]);
  const weakest = CATEGORIES.reduce((low, c) => values[c.id] < values[low.id] ? c : low, CATEGORIES[0]);
  const verdict = total <= 13
    ? { id: 'probation', label: 'ON PROBATION', emoji: '🚨', detail: 'Your dog has scheduled a very serious meeting about biscuits and boundaries.' }
    : total <= 23
      ? { id: 'improvement', label: 'NEEDS MORE TREATS', emoji: '📋', detail: 'Management sees potential. Performance improvements are requested immediately.' }
      : { id: 'approved', label: 'GOOD HUMAN', emoji: '🏆', detail: 'You may keep your job. Please remain available for emergency cuddles.' };
  return Object.freeze({
    scores: Object.freeze(values), total, max: 30, strongest: strongest.id, weakest: weakest.id,
    ...verdict, comments: Object.freeze(Object.fromEntries(CATEGORIES.map(c => [c.id, COMMENTS[c.id][commentIndex(values[c.id])]])))
  });
}

export function shareText(result, appUrl = 'https://kivzuno-hub.netlify.app/dog-performance-review/') {
  if (!result || !Number.isInteger(result.total) || !['probation','improvement','approved'].includes(result.id)) {
    throw new TypeError('Invalid review');
  }
  const url = new URL(appUrl);
  if (url.protocol !== 'https:') throw new TypeError('Share URL must be HTTPS');
  url.search = '';
  url.hash = '';
  return 'My dog gave me a performance review: '+result.total+'/30. Verdict: '+result.label+' '+result.emoji+'\nWhat would YOUR pet rate you? 🐶\n'+url.toString();
}
