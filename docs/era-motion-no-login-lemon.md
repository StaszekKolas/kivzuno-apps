# KIVZUNO server-side AI and Lemon Squeezy (2026-10-12)

## Current status (no registrations or spending)

- The owner chose Lemon Squeezy and Runway, without signing up for either today.
- The merchant checkout is NOT active: Lemon Squeezy requires merchant onboarding and identity verification before real sales.
- Server-funded AI is NOT active: Runway requires a developer API key and a credit budget. No charges may be made without explicit owner approval.
- The account-free KIVZUNO photo frontend is prepared in preview; it checks the actual backend readiness and refuses requests while disabled.
- The earlier Puter version remains available as an optional, collapsed testing mode, and may use the user's own Puter credits. It is NOT a viable mandatory customer login system.

## Runway photos and movies

- Image endpoint: POST /.netlify/functions/era-image-task. Calls text_to_image with gen4_image_turbo, one or two reference images, owner-approved budget only. The current model estimate is 2 credits (about US $0.02) per generated photo, before taxes, retries and costs outside the Runway API.
- Image generation gates: RUNWAYML_API_SECRET, KIVZUNO_IMAGE_QUOTA_SECRET, KIVZUNO_SERVER_IMAGE_ENABLED=owner-approved, KIVZUNO_IMAGE_MAX_DAILY=3. A hard global cap of 3 image jobs/day plus 1/client/day controls risks. These are NOT set by this change.
- Runway movie API gateway remains locked in the parent branch: gen4_turbo, 5 seconds, portrait, approx US $0.25 per successful attempted generation before all other costs.
- The AI image URL from Runway expires. Store/delivery and a private retention/deletion policy are prerequisites to live billing.
- Real Runway image and movie output is UNTESTED. CI mocks and live capability checks do not equal successful paid E2E output.

## Lemon Squeezy

- Implemented helper validates X-Signature using raw-body HMAC SHA256 and checks paid event, store, variant, status, order reference. A checkout-body helper is ready for the future real merchant variant.
- Public Lemon readiness endpoint reports paymentActive=false and checkoutReady=false; it cannot accept a payment.
- Real live Lemon requires merchant account, identity verification, product/variant/store, API key, pricing in GBP, webhook signing secret, KIVZUNO webhook fulfillment, secure paid order tracking, one-time Runway job claim, refunded/failed charge handling, private photo and video storage, lawful retention/deletion and actual payment-to-film E2E tests.
- The future checkout must be created only on the server and must not charge until verified fulfillment works. No Stripe Live or Lemon Live has been enabled.

## Test now without accounts

The Netlify preview can check that the no-login AI backend and Lemon endpoint both say unavailable. It cannot generate a no-login AI image or process any checkout without the required accounts and credentials. Existing PR #18 can confirm a zero-cost photo-to-Runway-format handoff; even that does NOT render a movie.

Sources:
https://docs.dev.runwayml.com/guides/using-the-api/
https://docs.dev.runwayml.com/guides/pricing/
https://docs.lemonsqueezy.com/help/getting-started/activate-your-store
https://docs.lemonsqueezy.com/api/checkouts/create-checkout
https://docs.lemonsqueezy.com/help/webhooks/signing-requests
