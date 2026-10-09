# KIVZUNO business experiment: Pet Walk Report

**Status:** MVP in a separate, unmerged Draft PR. NOT public on the KIVZUNO production website, NOT a paid product, no payment integration.

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

## Metrics and constraints

- Current Metricool KIVZUNO evidence retrieved 2026-10-09: TikTok Red Flag **890 views/6 likes/0 comments/0 shares**, Excuse-O-Matic **543 views/0 likes/0 comments/0 shares**, chaos quiz 10 views. Instagram Social Battery 226 views, Red Flag 21 views in same retrieved period. These are views, NOT site visits, customer leads or revenue. Buffer Panic Button was published later and is outside those social dataset rows.
- The Netlify metrics function currently stores aggregate `visit`, `start`, `complete`, and `premium_click` counters, with no real transaction data. Metricool Website returned a row of zeros; do not conclude actual site traffic is zero without verifying whether website tracking is correctly configured. No evidence of paying customers yet.
- Existing KIVZUNO content is entertainment-led. Distribution for this professional product needs **independent UK pet business audiences**, not only general viral reels.
- This MVP makes **no external HTTP calls**. It saves nothing server-side; photo stays as browser object URL and is cleared on reload; share text works via browser native share/copy; PDF via native Print→Save as PDF. No Stripe, emails or visitor tracking.
- Not a legal form, medical record, prescription tracking app, GPS report or veterinary advice tool.
- Competitors' prices and social data can change. Validate again before any public commercial positioning.

## Technical handoff

- MVP standalone prototype: `experiments/pet-walk-report/index.html`.
- Tests: `tests/pet-walk-report.test.mjs` and read-only GitHub PR CI.
- Existing Netlify `netlify.toml` publishes only `hub/`. This experimental page is deliberately **not** linked or deployed at the KIVZUNO production URL.
- Next gates: test synthetic inputs, manual iOS/Android gameplay, an explicit decision to pursue the idea, explicit approval before deploying a landing page, then small-scale discovery interviews. Don't announce sales or commit to pricing without evidence.
