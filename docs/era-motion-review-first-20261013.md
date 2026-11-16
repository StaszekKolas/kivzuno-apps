# KIVZUNO Era Motion — owner-approved review-first pipeline

**Date:** 2026-10-13  
**Scope:** Draft PR #26 / Netlify Deploy Preview. **NOT production. NOT customer-ready.**  
**Owner constraints:** no new model/provider charge without approval, no purchases, no ads, no invites, no merge or release, no automatic paid generations, no Runway auto-top-ups. Approved test reservation cap stays **300 total** (100 original + 200 extension).

## Diagnosis and technology selection

The original Gen-4 Image Turbo API (`POST /v1/text_to_image`) receives a reference image and generates a result; it is **not a deterministic pixel-level edit**. Stronger prompts can improve source framing but cannot guarantee accurate identity, a precise animal count, or that modern vehicles will always disappear. Real reference-preserving editing, masks and inpainting need a different capability/model.

Runway Dev's Ideogram 4.5 API documents `preciseEdit: true` for preservation of source composition, with optional `maskUri` for selecting editable pixels. Different models/qualities may charge **different credit amounts** (e.g. 1/4/8/25 per image by quality for that model). It has **NOT** been enabled or tested because the user did not separately approve a model/cost change.

Sources:
- https://docs.dev.runwayml.com/api-details/api_changelog/
- https://docs.dev.runwayml.com/guides/models/
- https://docs.dev.runwayml.com/guides/pricing/

## Implemented in PR #26

### PHOTO AI — independent
- Original horizontal photos retain a horizontal output request; vertical photos retain vertical.
- Era, subject action and `Faithful / Cinematic (default) / Epic` are validated on the server and applied to the image prompt.
- The prompt explicitly demands original framing, people/pet count, faces and markings; period transport replaces the modern van in the same position; asphalt, houses and fences must change. No new people.
- One image request consumes **2 existing approved Runway Dev API reservation credits**, after explicit confirmation. No auto regeneration.
- Image is marked **Needs Review**; it is not automatically quality-approved or sold.
- If an owner wishes, they can approve a PHOTO AI scene for future Film AI without generating a duplicate still (provided the original photo + era + look + motion + aspect match).

### FILM AI — independent and review-first
1. The owner selects the original photo, era, action and style within Film AI directly.
2. Owner clicks **Prepare historical scene (2 credits)**, after confirmation.
3. The image task completes and the browser checks image orientation; all identity, pet count, era, period transport, dynamism and anatomical details require OWNER VISUAL REVIEW.
4. Three visible review checkboxes plus **Approve for Film — free** are mandatory. Approval merely stores an authorized, provenance-verified index for the same source photo and creative settings; it starts **ZERO video tasks**.
5. A subsequent **Generate 5-second film (25 credits)** needs another explicit confirmation and rechecks approval server-side. That request animates the **approved transformed scene**, never the original unedited photo.
6. Once approved, a stored scene is found again by SHA-256 of the submitted photo + era + motion + style + aspect. Reopening the scene runs at most a **free GET on provider task state**; it does not create another image. No full original photo is stored in the index.
7. The browser checks the reported video duration (~5 sec) when metadata loads, but **actual motion, frame consistency and resemblance still require manual review**.
8. Video generation returns **REVIEW_REQUIRED**, not an unqualified claim of a good movie.
9. The former `scene_video_start` auto-animation endpoint has been retired. Historic unfinished auto-animation jobs return review required, without triggering a new paid generation through a status poll.

### Safety and cost control
- No public generation; all billable actions require server-side owner bearer token and matching origin.
- 300-credit approved reservation ceiling unchanged and still tracked atomically in site-wide Netlify Blobs; no history deleted or recredited.
- A film costs **2+25 credits only if BOTH stages are explicitly selected and approved**. A rejected stage costs 2 credits and **0** video credits. Reusing approved source costs **0** additional image credits.
- Failed tasks are **never automatically retried**, and possible spending is not automatically refunded.
- Inputs, creative choices and prompt lengths validated **before credit reservation**.
- The owner code and API secret are not stored in browser storage, logs or public UI.
- Production `main` stays unchanged; no merges, paid upgrades, checkout, public sharing, ads or testers.
- Changed model/provider is deliberately deferred pending price comparison and separate owner approval.

## Automated test plan

The no-network GitHub CI verifies:
- Syntax and private gates for image and video API calls.
- 12 eras × 5 actions × 3 creative modes and 1000-character provider image-prompt limit.
- Original horizontal output and photo count.
- Film cannot start before approval; approval and scene cache lookup spend no credits.
- Status polling after scene creation cannot start video automatically.
- Film submits a separate 25-credit provider task from the approved scene, not the original photo.
- Site-wide 300-credit cap, denied requests, owner-auth failures and lack of browser-stored secrets.
- Netlify deploy preview and mobile-responsive markup.

Automated tests do **NOT** prove visual output quality, motion fidelity or full iPhone Safari end-to-end playback. These are still pending owner testing using existing prepaid credits, after the owner explicitly confirms each generation.

## Owner acceptance checklist

Use the original white van + one driver + four dogs image:

1. Photo AI Viking / Cinematic / Animals walking. Spend 2 credits only once. Confirm original frame, count, recognizable faces and coats, period-correct transport/road/background, no extras and real action as a still.
2. If the result is weak, **do not approve** and do not generate a video. Send the photo for inspection. Do not auto-retry.
3. If adequate, open Film AI with **the same original photo and identical era/action/style**, and reuse the approved image. Complete the 3 checks and approve free.
4. Only after approval, decide whether to explicitly spend 25 credits on a film.
5. Play on iPhone: check real subject and vehicle movement, stable bodies/faces/animal count, correct 5-second duration and scene identity; don't equate a downloadable MP4 with quality approval.
6. No public release or customer payment until owner accepts both products.

## Remaining blockers / next work

- True selective image masking, image-to-image / precise editing with stronger identity preservation (**requires separately approved provider/model/cost choice**).
- Automatic semantic QA for people, pet count, modern artifacts, anatomically impossible parts, actual subject movement and interframe identity; currently human review required to avoid hidden evaluation costs.
- Durable private asset storage rather than expiring Runway output links; image reuse can fail when a provider link expires. No automatic regeneration.
- Verified video-frame motion metrics, not merely container duration. Browser's cross-origin restrictions can prevent inspecting provider frames.
- Payment verification, secure watermarked previews and watermark-free delivery: **not implemented**, no public launch authorized.
