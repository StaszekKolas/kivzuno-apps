# KIVZUNO Era Photo — private free preview

## Owner-approved direction (13 October 2026)
The user asked to replace the unavailable Era Motion listing on the KIVZUNO website with a new free photographic app and a **small embedded "KIVZUNO" watermark in the bottom-right corner** of each output.

**This branch is a private Deploy Preview only. It is not approved for merge to `main` or public release. No social posts, invites, checkouts, paid API generation or advertising were authorized.**

## What actually works now
- Open `/era-photo/` to select a local photograph (JPEG/PNG/WebP or HEIC supported by the browser).
- Choose one of six eras: Viking, Medieval, Wild West, Victorian, Ancient Rome, 1920s.
- Set atmospheric color grading intensity and render entirely in the browser using Canvas 2D. Includes cinematic contrast/tints, subtle particles, glow, fog and vignetting.
- Preserve the original image's orientation and aspect ratio. Limit rendering to a maximum side of 2048 pixels to reduce iPhone memory pressure.
- Save JPEG with small **pixel-burned** KIVZUNO mark positioned **inside the lower-right corner**. The watermark survives downloading and sharing. A "view original" comparison is offered.
- Do not upload the source photo or transmit it to a provider, and do not store it in cookies/localStorage.
- The visitor hub in `hub/index.html` replaces the old Era Motion promotion with `/era-photo/`; old `/era-motion/` paths force-redirect to the new photo app in this preview.
- No AI model, paid API, Runway video or payment is started. Free to the visitor and zero AI API cost to KIVZUNO.

## Scope limitation — important
**This is a free photographic styling editor, NOT a historical scene reconstruction AI.**
It cannot swap a modern van for an era-appropriate wagon, accurately replace the scene, or preserve identity while generating new historical objects. Those require a tested image-editing AI with a server-side key, pricing/budget controls, abuse prevention, clear photo retention consent, and **separate owner approval before public generation is enabled**.

The user previously considered ChatGPT/OpenAI and Canva; the Canva connector can generate images interactively but is not an automatically callable public backend for this Netlify app. A ChatGPT subscription does not include free OpenAI API requests. Do not sell or describe this browser editor as a full AI historical transformation.

## Testing and release requirements
`tests/era-photo.test.mjs` checks the app is linked and the old route retired, presence of six looks, no network/keys/payment, client-side photo processing, correct output aspect, and burned-in lower-right watermark. The existing GitHub release validation and no-network legacy suites remain.

Before any public release: obtain the owner's separate explicit go-live approval. Before enabling AI: select provider/model, obtain explicit API spend approval, implement real AI edit flow, cap per-user AND global costs with server-side limits, and test exact photo fidelity.
