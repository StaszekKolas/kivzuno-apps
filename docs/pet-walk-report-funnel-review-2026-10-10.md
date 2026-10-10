# Pet Walk Report funnel review — 10 October 2026

Status: review-only; no publishing, checkout, payment or product changes.

## Verified source-code gap

The Netlify metrics function allows app `petreport` and sources `fb_reel`, `fb_post`, `tiktok`, but `hub/stats.html` omits all four from its hard-coded labels and tables. As a result the dashboard hides the Pet Walk Report funnel and Facebook/TikTok breakdown even when counters exist.

## Proposed correction (not yet deployed)

Display `petreport` in the By app table and `fb_reel`, `fb_post`, `tiktok` in By traffic source. Display `premium_click` for both tables as an anonymous interest event, never as a purchase. Add an offline regression test. Do not change the data collection contract or weaken GPC/DNT handling.

## Marketing evidence

The one-time 9 October Pet Walk Report Buffer launch was confirmed SENT for Instagram, Facebook and TikTok by the read-only GitHub workflow. These statuses do not prove public post URLs or visits. Metricool on 10 October did not yet return Pet Walk Report rows; its three older Panic Button scheduled items instead show ERROR: `You have reached your Metricool account limit.` No reposting or paid upgrades.

## Validation gates

After owner review and separately approved deployment, inspect `/stats.html` and GET `/.netlify/functions/metrics?days=7` read-only; compare visits, starts, completes and premium clicks per source. Events are not unique users, qualified leads, orders or revenue. Recruit independent UK dog walkers only through permission-based, non-spam outreach. £9.99 is hypothetical Pro interest, not a product or checkout.
