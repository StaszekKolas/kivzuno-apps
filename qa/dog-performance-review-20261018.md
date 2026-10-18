# KIVZUNO — Dog Performance Review: QA handoff

Status: Draft PR / private review only. NOT approved for production publishing. No social media actions taken.

## Brief
- Format: Free English-only mobile miniapp inspired by the original silent 20-second vertical film "My Dog Just Rated Me One Star".
- Game loop: Enter optional pet name, change 3 scores from 0–10 (walks, treats, sofa sharing), press GET MY PERFORMANCE REVIEW, see a witty score (out of 30), verdict, 3 comments, and share the verdict.
- Video-faithful preset: walks 2/10, treats 9/10, sofa 1/10 → 12/30 · ON PROBATION. Button to load preset.
- Other verdicts: 14–23/30 = NEEDS MORE TREATS; 24–30/30 = GOOD HUMAN.
- CTA after owner-approved release only: https://kivzuno-hub.netlify.app/dog-performance-review/. This URL is proposed, not a verified public release yet.
- Marketing caption (English, for owner review only): "My dog has just put me ON PROBATION. 🐶📋 Walks: 2/10. Treats: 9/10. Sofa sharing: 1/10. What would YOUR dog rate you? Try the free Dog Performance Review on KIVZUNO! #KIVZUNO #DogHumor #DogPerformanceReview"
- Public media: None posted or scheduled by this PR.

## Safety, privacy, claims and rights
- All text, CSS and logic are original work authored for KIVZUNO. Browser/system emoji only, no imported imagery, external fonts, tracks, paid assets, AI generation or third-party clips.
- £0 incremental external cost expected. Existing GitHub/Netlify free-tier quotas still apply.
- Client-side rule-based scoring: no paid API, network fetch, database, analytics calls, login or persistent local storage.
- Optional pet name remains on page and is inserted using textContent, not innerHTML; share payload does not include pet name.
- Fictional/comedic review; does not purport to read real animals' feelings.
- Film asset previously created for owner: 20.0 seconds, 720x1280 H.264, silent. This PR does not change or publish that video.

## Evidence and QA results
- PASS local Node: node --test tests/dog-performance-review.test.mjs — 5 tests, boundaries, deterministic scoring, invalid inputs and share privacy.
- PASS local simulated browser: Chromium/Playwright with inlined module to work around browser network sandbox; widths 320, 390, 1280; default and max verdict, reset to video preset, no JS errors or horizontal overflow.
- PASS source readback: app files, test file, hub home card and release-gate CI change on agent branch.
- NOT RUN: Browser navigation to actual Deploy Preview and iPhone/Safari playback (sandbox navigation restricted).
- NOT RUN: Independent human editorial QA and screen reader audit.
- NOT RUN: Live production URL after merge because merge/deploy are not authorized yet.

## QA gates
1. Confirm Deploy Preview contains the app and home card, test sliders and share on Safari iPhone.
2. Confirm shared result does not include pet name; no tracking calls beyond ordinary hosting.
3. Check contrast, keyboard and VoiceOver, safe areas.
4. After independent QA pass, seek separate owner approval for merge and production deployment.
5. Only after public URL is verified, prepare film caption for separate social publication approval.

Explicit no-go: No merge, live deploy, schedule/post, ads, paid Runway, payments, outreach or Layeron changes.
