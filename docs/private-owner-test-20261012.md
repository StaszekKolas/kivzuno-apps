# KIVZUNO Era Motion — private owner beta (prepared, NOT launched)

## Access and release boundary

The test implementation lives on \`feature/private-owner-unlimited-tests-20261012\`.
**Do not merge, create a Netlify deploy preview, or promote to production without fresh explicit approval.**
The GitHub repository was already PUBLIC when this change was prepared; a GitHub branch is not a private store.
The existing public web page may still be reachable. Never present its URL as a private login portal until access controls are verified.

The old public \`era-image-task\` endpoint now requires an additional, separately approved
\`KIVZUNO_PUBLIC_IMAGE_ENABLED=owner-approved\` flag, intentionally NOT configured
during private owner testing. It continues its original daily quota policy only
if a future public beta is deliberately launched.

## Owner-only image and video feature

New Netlify function: \`/.netlify/functions/era-owner-test\`.

- \`capabilities\`: verifies owner access without charging or generating.
- \`image_start\`: a real Runway Gen-4 Image Turbo transformation, 2 API credits.
- \`video_start\`: a real Runway Gen-4 Turbo 5-second movie from the completed AI image, 25 API credits.
- \`status\`: checks a job via a server-stored Runway task ID. Each task has a separate
  unguessable token, as well as requiring owner authentication.

There is **no KIVZUNO daily image limit** for the owner. There is a durable, race-safe
**total test credit ceiling** so credits cannot be consumed without bounds.
Reservations are conservative and irreversible, including if Runway rejects a task.
The provider can still impose its own concurrency and tier limits.

The web page has a password-like access input which never persists in localStorage
or sessionStorage. No API key is present in browser code. A separate consent and
browser confirmation are required before each video submission.

## Netlify variables to configure only at approved private release

The Netlify administrator must configure these **server-side** environment values
in the correct Netlify site (Functions runtime scope), never in browser code:

- \`RUNWAYML_API_SECRET\`: an active Runway **Dev API** project key. Check whether it
  is already configured; do not paste the value into chat or commit it.
- \`KIVZUNO_OWNER_TEST_ENABLED=owner-approved\`
- \`KIVZUNO_OWNER_TEST_TOKEN\`: random, secret, at least 32 characters, to be typed
  in the app's owner access input only. Save it privately in a password manager.
- \`KIVZUNO_OWNER_TEST_BUDGET_CREDITS=100\`: conservative starting ceiling.
  Valid range is 25–1000 credits; 100 is ~4 video jobs if no images are used.
  This applies only to this particular beta service and is not a Runway billing cap.

Keep \`KIVZUNO_PUBLIC_IMAGE_ENABLED\` UNSET. Do not enable a payment webhook,
KIVZUNO public media generation or checkout.

## Spend and confidentiality warnings

"Free for owner" means no KIVZUNO checkout. **Runway Dev API uses existing credits**:
2 credits per Image Turbo image, 25 credits for one 5-second Gen-4 Turbo video
(pricing verified 2026-10-12). API project credits are NOT automatically the same
as Runway ChatGPT-connected workspace credits or Runway web-app plan credits.

Runway Dev auto-billing must separately be checked and DISABLED before tests:
the beta application itself cannot switch off provider auto-recharges.
A running job can consume credits even if a browser connection fails or the user
closes the tab. Jobs are never retried automatically. No new credit purchases
or plan upgrades are made by the app.

Runway output URLs are temporary. Do not treat them as durable photo/video storage.
Provider may retain generation data per its terms.

## Validation required before anyone uses the new release

1. Local/node syntax checks for \`hub/era-motion/studio-simple.js\`,
   \`netlify/functions/era-owner-test.mjs\`, \`era-image-task.mjs\`.
2. Contract tests in \`tests/owner-beta.test.mjs\` and existing app tests.
3. Confirm unauthenticated \`image_start\` and \`video_start\` both return HTTP 403
   after the feature is configured.
4. Confirm \`capabilities\` without a valid owner token always returns \`available:false\`.
5. Confirm previously enabled \`era-image-task\` cannot start public generation.
6. Only then make exactly one authorized live image and exactly one video from it,
   checking the Runway Dev credit balance before and after.
7. No external invitation, social promotion, or paid customer launch without approval.

API pricing: https://docs.dev.runwayml.com/guides/pricing/
Runway Dev auto-billing: https://docs.dev.runwayml.com/usage/autobilling/
