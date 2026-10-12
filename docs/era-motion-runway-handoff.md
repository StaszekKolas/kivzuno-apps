# KIVZUNO Era Motion → Runway (staged integration, 2026-10-12)

## What works in the branch

The customer creates an era AI photo through Puter. KIVZUNO uses the actual generated image already held in its browser, without asking the customer to upload the same photo again. On explicit, separate consent, the "Check automatic transfer to Runway · £0" action converts the image to a compact JPEG data URI and sends it to a same-origin Netlify Function. The function checks the image, Runway's 5 MB data URI limit, and the selected era and then discards the bytes. It never generates a movie, charges credits, or stores the image.

The server contains a locked-down implementation of Runway POST /v1/image_to_video and GET /v1/tasks/:id, but these paid operations are blocked by default. Planned model: gen4_turbo, 5 seconds, 720:1280. Published Runway API pricing is 5 credits/second, meaning 25 credits = US$0.25 per video before taxes, failed retries, processing fees or storage. Free Runway app credits do not pay for API calls.

## Hard gates before real paid generation

Real Runway calls require ALL of the following server-only configuration:
- RUNWAYML_API_SECRET (never send it to browser or GitHub)
- KIVZUNO_RUNWAY_ORDER_SIGNING_SECRET
- KIVZUNO_RUNWAY_PAID_ENABLED=owner-approved
- A valid HMAC-signed, unexpired, paid order entitlement cryptographically tied to the exact image bytes
- An idempotency claim in Netlify Blobs before Runway is called; the same paid order can never trigger two billable requests

NO checkout or trusted payment-verification webhook exists today to issue entitlements, so no customer can invoke a billable Runway job. The future webhook must verify the payment provider's signature, actual cleared payment, order price/currency, one-time issuance, image hash and status, refunds, chargebacks and replay prevention. Never mint the entitlement from untrusted browser data.

## Important known limitations

- Transfer from Puter to the Netlify function needs a real iPhone user test. If the Puter image URL blocks browser CORS reads, the app reports an honest error. It does not proxy arbitrary URLs or upload the photo to a third-party service without consent.
- The preflight proves only that the same image bytes arrived at KIVZUNO and passed validation. It does NOT prove that Runway has generated a film.
- The customer cannot buy or generate Runway films through KIVZUNO yet. Paid Runway API credentials, a checkout, confirmed pricing/margins, secure retention and video-delivery storage must be approved separately. Runway output links expire in 24–48 hours and must not be treated as permanent delivery links.
- An older optional Puter video beta remains collapsed; it uses the user's Puter account, not Runway.
- Do not advertise Runway videos as currently available.
- No financial integrations, paid API calls, credit top-ups, boosts or posts were created or enabled by this PR.

Docs:
https://docs.dev.runwayml.com/guides/using-the-api/
https://docs.dev.runwayml.com/assets/inputs/
https://docs.dev.runwayml.com/guides/pricing/
https://docs.dev.runwayml.com/assets/outputs/
