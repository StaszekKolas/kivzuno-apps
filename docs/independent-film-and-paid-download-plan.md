# KIVZUNO: Film-first product with a free watermarked teaser

Status: DESIGN + PRIVATE SOURCE BRANCH ONLY, NOT LIVE. 2026-10-13.

## Owner decisions

- Films are the primary product; photo transformation is a teaser and secondary optional product.
- Two independent generation flows: Photo AI and Film AI. Film AI accepts the original uploaded photo and generates directly without first generating a new AI photo.
- Customers may view results before buying; the film must have visible actual motion, not an unchanged image in an MP4 container.
- Preview results: KIVZUNO watermark BAKED into the photo pixels and into video frames.
- On successful verified payment per generation, download the corresponding high-quality original WITHOUT watermark.
- No payments, public generation, invitation, advertising, paid subscription, additional credits or new provider spend is authorized by this branch.

## Film quality acceptance (mandatory before charging)

1. The output container is a playable video with an expected 5-second duration. Verify actual media metadata (server-side ffprobe or equivalent), not the web player timeline.
2. Check multiple decoded frames spread throughout the clip. A sequence of identical or nearly identical frames is **not a motion video**. Use motion metrics (SSIM, mean absolute pixel difference, or optical-flow estimates) with scene-aware thresholds; validate on real samples. Camera-only pans can be marked separately from meaningful subject movement.
3. Confirm the intended subject survives the transform and actually changes pose/position. Automated frame-difference tests alone cannot guarantee genuine, acceptable action; use owner/human review until there is a trustworthy classifier.
4. Distinguish provider success from product success. If the AI returns a still-looking MP4 or a much shorter clip, mark it **REVIEW_REQUIRED** instead of **READY_TO_SELL**. Do not automatically retry a credit-consuming request; expose the failure and investigate.
5. Use action-directed prompts, e.g. walking dogs with visible legs/paws movement, a cart with rotating wheels and travelling hooves, a waving subject, or a lateral tracking shot. Allow user-selected movement.
6. Keep clips as single continuous scenes. If poor motion persists, benchmark newer video models and pricing with explicit owner credit approval.
7. Determine whether a reported 3-second result was a truncated download/browser playback or an actual three-second MP4 by inspecting the ORIGINAL generated video file.

Runway Gen-4 Turbo documented duration is 5 or 10 seconds; 24 fps. Their prompting guide recommends short direct motion descriptions rather than subtle/nonmotion constraints. References:
https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide
https://help.runwayml.com/hc/en-us/articles/37327109429011-Creating-with-Gen-4-Video

## Secure preview-first payment design — NOT IMPLEMENTED

- The backend securely ingests the provider's clean original into private storage before any customer preview.
- Do not give unpaid clients the original provider video/image URL or unwatermarked file bytes; hiding a button or adding a CSS overlay is not access control.
- Create two different output assets. **Preview photo:** smaller raster with visible semi-transparent KIVZUNO marks baked into the pixels. **Preview video:** smaller transcoded video with persistent watermark baked into all frames, plus a labeled thumbnail.
- After verifying and recording a payment-provider webhook server-side, grant an expiring download entitlement bound to one generation and buyer; issue a short-lived private signed URL/download proxy for that generation's unwatermarked asset.
- Watermark and reduced resolution discourage casual reuse but cannot prevent screen recording or screenshots.
- A free-to-view preview still incurs provider generation costs even if nobody buys. Before public launch, introduce a small verified free-trial quota, bot/abuse protection, limits per user/device, a strict provider credit ceiling, and contribution-margin review. Do not promise unlimited free generations.

## Current private test implementation

A separate GitHub branch builds film-from-original and image-from-original independently. Its owner test endpoints still serve raw provider assets only to an **authenticated owner**, not customers. They are NOT safe to expose to anonymous end users as a monetized product until the media storage + transcoding + watermark pipeline + payment verification are finished.

The existing working Deploy Preview #25 was NOT modified by this branch. No new Deploy Preview, checkout, customer publishing or paid Runway task has been authorized or initiated for these changes.
