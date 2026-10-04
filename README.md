# KIVZUNO — Tiny apps. Unexpected fun.

Live hub (Netlify): https://kivzuno-hub.netlify.app/

Static source: `hub/index.html`. `netlify.toml` configures `publish = "hub"`; no build command or dependencies. If the existing Netlify site isn't connected to this GitHub repo, connect it once with production branch `main`, publish directory `hub`, then deploy.

## Built-in apps
- Social Battery Diagnostics: https://kivzuno-hub.netlify.app/#battery
- Red Flag or Just Tuesday?: https://kivzuno-hub.netlify.app/#flag
- Panic Button for Adults: https://kivzuno-hub.netlify.app/#panic
- Premium Chaos Lab: https://kivzuno-hub.netlify.app/#premium (free working demo; no real payment or verified fulfillment)

The hub also links to the previously hosted free Chaos Quiz and Excuse-O-Matic. The built-in apps collect no answers; quiz state is kept in browser memory. No analytics package, cookies or API keys are included in this static page.

## Payment status
Stripe Jedras Digitalstudio is currently Sandbox-only. A test £0.99 product and price exist but are not wired to this hub. To enable live purchases, implement server-side Checkout Session creation, webhook signature verification, order fulfillment and secure access to purchased results; test those in Sandbox and obtain the owner's approval for Live and consumer disclosures. Do **not** unlock a premium feature based solely on a success URL or expose Stripe secret keys in this repo.

## Aggregate conversion analytics (October 2026)

- Public (unlisted, noindex) event-only dashboard: https://kivzuno-hub.netlify.app/stats.html
- Netlify function: `/.netlify/functions/metrics`. Uses `@netlify/blobs` (pinned in root `package.json`), site-wide EU Frankfurt storage, daily counters, conditional writes. No new paid account or Netlify upgrade is part of this implementation. Make sure the existing site deploys `main` with repository root as base, publish directory `hub`, and functions directory `netlify/functions`.
- Trackable direct Social Battery link for a Story sticker: `https://kivzuno-hub.netlify.app/?src=ig_story#battery`. Also accepts `ig_reel`, `ig_bio` and `ig_post` as source; untagged traffic is `direct`. To distinguish bio traffic, the owner must update their actual Instagram bio link.
- Counts are events, not verified unique people. The client sends only a validated source/app/event tuple to its own origin and does not send answers, names, email addresses or user IDs, or set cookies. The host may process technical request metadata. A publicly readable count is not tamper-proof; do not use these figures for financial reporting. Honors browser Do Not Track / Global Privacy Control.
- App page views count once per app per page load; a new quiz attempt counts as a start, an answered final question as a completion; Premium offer click records curiosity only, **not a purchase**. Paid fulfillment remains disabled while Stripe Live isn't verified.
- If `stats.html` reports unavailable or the browser cannot POST to the function, investigate Netlify deploy/Functions/Blob limits rather than showing fabricated zero conversion.
- Organic Instagram Reels do **not** carry a clickable external URL. A link sticker in an Instagram Story requires manual native publishing; Metricool cannot auto-publish the interactive sticker. Paid Meta ads with native CTA require separate approval and budget; this repo does not create or buy ads.
