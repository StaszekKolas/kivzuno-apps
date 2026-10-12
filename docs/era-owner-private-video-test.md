# KIVZUNO Era Motion · PRIVATE OWNER TEST (not yet deployed)

This work is stacked on PR #22 and NOT on the live site. No public release, no customer checkout, no promotion.

## What this version actually does

- Lock the photo studio behind an owner test access key, entered on the page. Never share the key, include it in screenshots, or check it into GitHub.
- Server API rejects anonymous image and video generation with 403 BEFORE any charged provider call. Site files/marketing pages on Netlify remain technically reachable: this is **authorization for billable generation**, not Netlify site-wide password protection. For true private hosting, configure Netlify access controls separately.
- Owner can create new photos without the previous one-per-IP/day and 3/day quota. A new lifetime test budget caps at 40 photos = 80 credits.
- After creating an image, manually approve ONE 5-second image-to-video task from its previously generated Runway photo URL. No second image upload. Each attempt costs 25 prepaid credits, capped at 4 tasks = 100 credits.
- Total theoretical new test allocations: **180 credits of the already purchased balance**; a provider may charge for failed tasks; slots are consumed on attempted generations and not automatically refunded. No automatic retries or double-start per image. Other Runway costs not included.
- The new video can be played and opened from Runway's temporary media link. Save before expiry. No durable customer storage or full commercial purchase/delivery system yet.

## Owner must set Netlify environment variables
Existing photo envs must remain server-only: `RUNWAYML_API_SECRET`, `KIVZUNO_SERVER_IMAGE_ENABLED=owner-approved`, `KIVZUNO_IMAGE_QUOTA_SECRET`, `KIVZUNO_IMAGE_MAX_DAILY=3`. The last two remain for backwards-compatible public features in the existing version, but private owner testing uses separate lifetime caps instead.

Add exactly:
- `KIVZUNO_OWNER_TEST_SECRET`: **strong unique random 32–64+ character secret**, never written to chat/GitHub, preferably mark sensitive and scope Functions. Do not copy an example or predictable phrase.
- `KIVZUNO_OWNER_TEST_ENABLED`: `owner-approved` after checking the preview and cap.
Ensure Netlify Functions can read the variables on preview and live; redeploy when changed.

Only when BOTH keys above exist AND owner approves merging PR #22 then PR #23 can the private owner studio be used on the main domain. A preview can be tested in non-billable locked state without activating it. If preview and production share environment, the private owner key still restricts API use, but **URLs to static files are public**.

## Use on iPhone
1. Open the owner-only version (after deployment/approval), paste the secret from your password manager into the private-key field and tap Unlock. The key is held only in memory, not localStorage or a URL.
2. Upload a photo, select an era, consent. Tap Create my AI photo once; use the Runway API balance for this.
3. After the generated image appears, decide whether to tick approval for ONE 5-second movie (25 credits) and click Animate. Wait for the result before any further action.
4. Save both generated assets immediately. Do not refresh while a task is running.

## Test and caveats
- Automated tests/smoke checks do not call billable Runway providers.
- Verify actual movie generation only after owner manually grants access and confirms use of prepaid credits.
- The existing per-day public cap on current main will not be removed until owner approves a deploy. Do not bypass it by changing headers or spoofing an IP.
- No Lemon Squeezy store, paid video orders, customer payments, or completed checkout are enabled.
- This mechanism is intended for owner **testing only**, not sharing with buyers. It should be replaced with verified commercial authorization and durable media delivery before monetization.

Official pricing: https://docs.dev.runwayml.com/guides/pricing/ (2 credits per gen4_image_turbo image, 5 credits per second of gen4_turbo video).
