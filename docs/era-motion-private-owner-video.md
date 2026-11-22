# Era Motion — private owner-only image and video test

**This branch is NOT a public launch. Do not merge without a new owner approval.**

## What is implemented
- Netlify Edge Function blocks /era-motion/* and billable AI function endpoints from anonymous visitors.
- Password form sets 12-hour signed HttpOnly Secure SameSite=Strict cookie. Every paid Netlify Function independently verifies session.
- Owner image testing removes previous one-per-IP daily limit, retaining an upper safety bound of 10 photo attempts per UTC day.
- Gen-4 Turbo 5-second video is requested from exactly the Runway source image task completed in this browser. No second upload. Separate explicit 25-credit consent button; 2 video attempts per UTC day.
- Per-source-image once-only claim; no automatic retry after possible provider billing.
- Not tested yet with a real Runway video result. No checkout, customer charge, email delivery, permanent video storage or sales.

## Owner adds these three variables privately in Netlify
- KIVZUNO_PRIVATE_BETA_ENABLED = owner-approved
- KIVZUNO_OWNER_TEST_SECRET = unique strong password of at least 32 random characters, created by owner in password manager. Never paste in chat.
- KIVZUNO_OWNER_VIDEO_TEST_ENABLED = owner-approved (only when owner agrees to spend existing developer credits on film test).

Scope must include Functions for Edge Functions and serverless functions. Set the deployment context appropriately; fresh deploy required for new edge variables.

Existing Runway developer key and existing image flags remain configured by owner. Under private mode 10 owner photo attempts per UTC day replace the one-per-IP and 3/day ceilings. The former public constants remain in source for any later public mode.

## How to test
1. Add variables and trigger a **new preview deploy**. Before this configuration the preview deliberately returns HTTP 503.
2. Open preview URL on iPhone and type private password. Do not share the password or URL.
3. Upload Polar's photo, pick era, consent, generate actual AI photo.
4. Under generated image choose to spend around 25 existing Runway API credits and manually click Create 5s video.
5. Wait for task output. Save file promptly: Runway output URLs expire.

## Crucial caveats
- Credits on owner Runway Developer account ARE consumed by test requests, even though no payment is collected from the owner via KIVZUNO.
- 10-image / 2-video daily caps are credit guardrails, not a financial hard cap and do not automatically stop after the 1000-credit balance runs out. Keep auto-recharge off and watch billing.
- This feature branch does NOT hide the already published production site. Owner may separately password-protect production in Netlify. No new release, public marketing or checkout until explicit approval.
- The video API code and authentication need real E2E validation before any claim it works, and an actual paid customer workflow requires a merchant account, verified webhook, safe media storage, refund and retry policy.

Official docs: https://docs.netlify.com/prompt-templates/netlify/password-protect-a-page/
https://docs.netlify.com/build/edge-functions/environment-variables/
https://docs.dev.runwayml.com/guides/using-the-api/
https://docs.dev.runwayml.com/usage/billing/