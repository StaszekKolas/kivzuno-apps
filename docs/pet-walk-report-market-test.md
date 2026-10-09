# KIVZUNO business experiment: Pet Walk Report

**Status:** Free MVP and price-interest test proposed in a Draft PR; after explicit merge it will be served at `https://kivzuno-hub.netlify.app/pet-walk-report/`, pending a confirmed Netlify Production deploy. There is no active paid product, checkout or payment integration.

## Hypothesis: who pays for what?

**Customer:** UK independent dog walker, pet sitter or solo pet-care professional handling clients via WhatsApp, not a full booking system.

**Job-to-be-done:** After a walk, send a tidy, trusted update in under 60 seconds. Include dog's name, date, duration, mood, weather, short written update, optional photo. Share text via the phone's share sheet or print/save as PDF. It runs in the browser without accounts, cloud data or uploaded photos.

**Reason this may be commercially interesting:** there are publicly advertised, paid competitor options:
- [Pawfect UK](https://paw-fect.uk/): pet-business plans advertised starting at **£5.99/month**, with visit reports and additional features. Published price as checked 2026-10-09.
- [Pet Sitter Plus](https://www.petsitterplus.com/pricing): advertised starting at **£24/month** for Solo (actual offers and promotions may vary); includes far more than walk reports.
- [Etsy UK — Dog Walker Client Forms](https://www.etsy.com/market/dog_walker_client_forms): paid digital bundles and templates at a broad range of prices, including single low-priced documents and bundles around £5–£13. This shows an existing MARKETPLACE of paid options, not verified demand for our particular idea.
- [Scout Pet Parent features](https://www.scoutforpets.com/features/pet-parents): illustrates that report cards and photos already exist as paid-suite features, which is also strong competition.

**Differentiation to test:** zero setup, one-screen creation and WhatsApp-ready share, local-only personal details and photo, no monthly software commitment just to produce a branded walk summary. Avoid pretending to rival full-service pet business systems.

**Monetisation hypotheses, NOT real prices or transactions:**
- Free: text share + simple A4 PDF walk card; the demo implements this.
- Potential Pro: custom business logo, prefilled client templates, professional report themes, batch export and unlimited branded PDF cards. Hypothesised **£3.99/month** or **£9.99 one-time early-buyer bundle**, subject to willingness-to-pay research, fees, maintenance and UK consumer rules.
- Do not enable checkout or collect money until explicit user authorisation and legal/compliance review.

## The smallest genuine business test (£0 incremental cost)

1. Owner or researcher recruits **10 UK dog walkers/pet sitters** from permitted community channels or existing contacts, without spamming or automated unsolicited outreach. Explicit permission required before sending any outreach.
2. Ask them to use the free local-only demo with *fictional pet details initially*, and time how long it takes.
3. Ask: “Would you use this after each walk?”, “What is missing?”, “How do you currently send updates?”, and “Would custom branding + client templates be worth £3.99/month or £9.99 once?” Do not treat positive verbal answers as sales.
4. Success threshold (hypothesis): 6/10 can create a report in under 60 seconds; at least 3 request a repeat visit; 2 or more explicitly request a paid feature and accept a clear price. Stronger proof requires actual paid conversions after payment is authorised.
5. If no credible interest, **stop**. No sunk-cost expansion.

## Free-to-Pro interest measurement

The £9.99 one-time Pro pack is only a stated **hypothesis** (brand logo, reusable client templates and report themes), not yet available to buy. The free public demo contains a clearly labelled 'I'd consider the £9.99 Pro pack' button, recording an anonymous `premium_click` event (as well as `visit`, `start`, and export-intent `complete`) in the KIVZUNO Netlify metrics endpoint. The request contains only `{app:'petreport', event, source}` — never pet name, photo, notes, or a personal ID. Global Privacy Control / Do Not Track disables it. Never report clicks as verified demand, unique people, Stripe purchases or revenue. Compare aggregate funnel counts before asking permission for Stripe Live.

## Metrics and constraints

- Current Metricool KIVZUNO evidence retrieved 2026-10-09: TikTok Red Flag **890 views/6 likes/0 comments/0 shares**, Excuse-O-Matic **543 views/0 likes/0 comments/0 shares**, chaos quiz 10 views. Instagram Social Battery 226 views, Red Flag 21 views in same retrieved period. These are views, NOT site visits, customer leads or revenue. Buffer Panic Button was published later and is outside those social dataset rows.
- The Netlify metrics function currently stores aggregate `visit`, `start`, `complete`, and `premium_click` counters, with no real transaction data. Metricool Website returned a row of zeros; do not conclude actual site traffic is zero without verifying whether website tracking is correctly configured. No evidence of paying customers yet.
- Existing KIVZUNO content is entertainment-led. Distribution for this professional product needs **independent UK pet business audiences**, not only general viral reels.
- The production demo makes **only same-origin anonymous KIVZUNO metrics calls**, and honours browser privacy controls. No dog name, notes, photo or client information is sent or stored server-side. Photos stay as browser object URLs and clear on reload; native share/copy and Print→Save as PDF. No Stripe, emails or customer tracking.
- Not a legal form, medical record, prescription tracking app, GPS report or veterinary advice tool.
- Competitors' prices and social data can change. Validate again before any public commercial positioning.

## Technical handoff

- MVP standalone prototype: `experiments/pet-walk-report/index.html`.
- Tests: `tests/pet-walk-report.test.mjs` and read-only GitHub PR CI.
- Existing Netlify `netlify.toml` publishes only `hub/`. The PR now contains a production-ready copy at `hub/pet-walk-report/index.html`, with a separate card for useful tools on the main hub. This copy will be deployed only after PR merge and Netlify production confirmation. The source experiment remains under `experiments/`.
- Next gates: review synthetic CI and Preview, obtain production deploy confirmation, manually play through iOS/Android and print/share; then validate real use and price interest with dog walkers, without unsolicited outreach. Do not announce sales or commit to pricing without evidence.
