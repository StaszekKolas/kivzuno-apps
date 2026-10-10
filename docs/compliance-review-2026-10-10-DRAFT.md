# KIVZUNO — compliance review / DRAFT ONLY (2026-10-10)

> **UNAPPROVED WORKING DOCUMENT.** Not a published privacy notice, terms of sale, legal clearance, or authority to activate checkout or social posting. Scope: KIVZUNO only, not Layeron. No production changes, new fees, registrations, or filings.

## Verified code inventory (main as inspected 2026-10-10)

| Area | Evidence | Finding / action |
| --- | --- | --- |
| Event analytics | `netlify/functions/metrics.mjs` | Allowlisted `visit`, `start`, `complete`, `premium_click` counts by UTC day/app/source, stored in Netlify Blobs in `eu-central-1`. POST payload has no names, answers, emails, customer IDs, or payment amounts. GET exposes public aggregate counts. Events **are not unique users, verified conversions, sales, or income**; automated/repeated events can inflate totals. |
| Retention | `netlify/functions/metrics.mjs` | No retention TTL or deletion job was identified in this function. GET only *filters* to last 1/7 days; this is not deletion. **Confirm** platform-side retention and implement a documented deletion mechanism before asserting a retention period. |
| Analytics notice/choice | `hub/index.html`, `hub/pet-walk-report/index.html` | Short disclosures exist; DNT/GPC respected. No complete, easily discoverable privacy notice or in-page analytics objection control found in inspected files. Assess whether ICO's statistical-purpose exception applies, and implement clear information and a simple free objection mechanism if relying on it. No blanket assertion that every anonymous counter requires a cookie banner; first verify whether storage/access technologies are used. |
| Infrastructure data | Netlify deployment + `metrics.mjs` rate limit | Netlify can process technical request metadata, including IP for rate limiting. Do not claim the entire service processes no personal data merely because the counter payload is aggregated. Document hosting/processor, location, security and retention after checking provider settings. |
| Public metrics | `hub/stats.html` | Public, unlisted/noindex dashboard; this is not access control. Ensure only intentionally public aggregate information is present. |
| Pet Walk Report | `hub/pet-walk-report/index.html` | User-entered pet details and photos are intended to remain browser-side. Verify network requests, native share behaviour and print/PDF on actual deployment; do not promise no processing of technical logs. The `£9.99` Pro pack is **interest-only** and must not be described as purchasable. |
| Cross-project separation | `hub/layeron/index.html` | Layeron landing content exists inside KIVZUNO repository/deployment tree. Confirm whether this is intentionally deployed and whether separate ownership, domain and policies are needed. **Do not move or delete without owner approval.** |
| Social automation | `.github/workflows/kivzuno-buffer-queue.yml`, `.github/workflows/kivzuno-pet-report-launch.yml`, `content/buffer/approved.json` | The recurring Buffer queue uses an activation gate and the manifest is empty on inspected main. A separate one-time Pet Walk Report workflow can submit posts after public asset checks. This code review **does not prove current Instagram/Facebook/TikTok delivery or label settings**; inspect actual platform records. |
| Promo rights | `scripts/buffer/render-pet-report-promo.sh` | Video is generated locally with FFmpeg, DejaVu Sans and silent audio; no third-party music or footage is referenced in this render script. This is **not** a licence audit of all prior/other social posts, Canva assets or AI media. Preserve per-asset provenance and permitted uses. |
| Payments | `README.md`, `hub/stats.html` | Documents Stripe as Sandbox-only; no Stripe Live verification or payment ledger inspected. `premium_click` must never be booked as revenue. |

## Unresolved legal/tax controls (owner/accountant verification)

- **HMRC 2025/26:** deadline to notify HMRC of a new Self Assessment obligation was **5 October 2026**, now past. Check *all* qualifying gross trading receipts across activities for the tax year 6 Apr 2025–5 Apr 2026, not only KIVZUNO. HMRC describes the £1,000 trading allowance threshold as combined side-hustle gross receipts. No KIVZUNO receipt is assumed; no statement is made that the owner has/has not registered.
- **UK VAT:** current registration threshold £90,000 taxable turnover over a rolling 12-month period or expected in the next 30 days. Check the seller's total relevant turnover and place of supply. Cross-border B2C digital supplies may attract tax in the consumer's country regardless of the UK registration threshold. Obtain specialist advice or assess Merchant of Record contractual responsibilities before checkout.
- **Consumer law:** if paid digital content is offered, display the seller's legal identity, contact, price inclusive of applicable taxes, functionality/compatibility, and cancellation/refund terms. For immediate digital content supply during the cancellation period, obtain the required express consent and acknowledgment of cancellation consequences; statutory remedies for faulty digital content cannot be removed by a blanket 'no refunds' statement.
- **Trade marks:** no complete UK IPO/EUIPO/WIPO clearance has been carried out. Check exact and similar spellings/phonetics, logos and appropriate classes; do not claim registration or guaranteed availability. Preserve an evidence log of search date, query and class.
- **AI/marketing:** audit each published Meta/TikTok post for platform-specific AI disclosure, commercial-content labeling, accurate CTA, functioning landing link, and rights to images/music. Never claim fake percentages, measured IQ or verified conversion where not supported.
- **Data-protection roles:** identify actual legal operator, contact address, lawful basis for any personal data, processor contracts, transfers, retention, rights/complaints contact, and whether an ICO fee applies.

## Draft privacy-notice skeleton — NOT FOR PUBLICATION

**Operator:** [legal name and contact details — owner approval required].

**What the apps do:** KIVZUNO offers free browser-based miniapps. Certain inputs (quiz answers, dog names, notes and photos) are intended to stay in the browser during use; confirm behaviour per app and deployed version.

**Analytics:** We currently count aggregate app/source/day events (visits, starts, completions and premium-interest clicks) through a first-party endpoint. We do not use these counts to identify unique people or infer payments. [Add verified legal basis, whether any storage/access technology is used, a simple analytics opt-out if needed, and precise implementation.]

**Infrastructure:** [Name hosting provider, request metadata/IP processing, location, subprocessors, international transfers and security arrangements after verification.]

**Retention:** [Verified Netlify Blobs TTL/deletion schedule, infrastructure log retention and any other stores. Do not invent numbers.]

**Rights and contact:** [Data rights, complaint contact, ICO complaint information, response channel].

**Cookies and similar technologies:** [Inventory and purpose, whether consent or an exception applies, how to object; never claim 'no cookies' for all third parties without checking the deployed site.]

## Release/approval checklist

- [ ] Owner confirms legal operator and contact details; privacy notice reviewed for each public app.
- [ ] Verify deployment and hosting metadata, Netlify Blobs retention and deletion; document processor terms.
- [ ] Confirm whether analytics meets ICO statistical exception; add easy free objection control and test DNT/GPC.
- [ ] Confirm no unintended personal data in metrics and no mislabeling of aggregate events as people/sales.
- [ ] Resolve Layeron landing page presence under KIVZUNO scope (separate decision; no automatic changes).
- [ ] Verify exact URLs and actual platform publication states, AI and commercial disclosure labels, crossposting attribution.
- [ ] Record rights provenance for all social images, fonts, audio and videos; avoid unsupported claims.
- [ ] Keep Stripe Live off. Before any paid launch: seller-of-record, VAT destination, checkout/cancellation/refund, receipts and ledger approved.
- [ ] Verify UK IPO similar marks/classes; no unsupported assertion of trademark rights.
- [ ] No public policy, checkout, deployment, filings, registration, ad spend or purchase without explicit owner authorization.

## Official sources checked 2026-10-10

- HMRC Self Assessment: https://www.gov.uk/register-for-self-assessment ; https://www.gov.uk/government/news/say-i-do-to-getting-your-side-hustle-tax-right
- HMRC VAT: https://www.gov.uk/how-vat-works ; https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers
- ICO storage/access technologies guidance, finalised 29 Apr 2026: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
- ICO privacy notice: https://ico.org.uk/for-organisations/advice-for-small-organisations/privacy-notices-and-cookies/are-you-transparent-about-how-you-use-peoples-data/
- Consumer cancellation: https://www.legislation.gov.uk/uksi/2013/3134/regulation/37
- Consumer Rights Act digital content: https://www.legislation.gov.uk/ukpga/2015/15/part/1/chapter/3
- IPO trade mark similarity: https://www.gov.uk/how-to-register-a-trade-mark/before-you-apply
- IPO copyright/licensing: https://www.gov.uk/guidance/ownership-of-copyright-works
- TikTok commercial disclosure: https://ads.tiktok.com/resources/help/article/how-to-turn-on-the-commercial-content-disclosure-setting-in-tiktok
- Meta AI labels: https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/

*Evidence limitations: no direct trademark registry result search, no Netlify dashboard access, no verified live Stripe transaction export, and no per-post cross-platform publication/label inspection in this review. All operational changes require separate authorization.*
