# KIVZUNO — Tiny apps. Unexpected fun.

Live hub (Netlify): https://kivzuno-hub.netlify.app/

Static source: `hub/index.html`. `netlify.toml` configures `publish = "hub"`; no build command or dependencies. If the existing Netlify site isn't connected to this GitHub repo, connect it once with production branch `main`, publish directory `hub`, then deploy.

## Built-in apps
- Social Battery Diagnostics: https://kivzuno-hub.netlify.app/#battery
- Red Flag or Just Tuesday?: https://kivzuno-hub.netlify.app/#flag
- Panic Button for Adults: https://kivzuno-hub.netlify.app/#panic
- Premium Chaos Lab: https://kivzuno-hub.netlify.app/#premium (free working demo; no real payment or verified fulfillment)

The hub also links to the previously hosted free Chaos Quiz and Excuse-O-Matic. The built-in apps collect no answers; quiz state is kept in browser memory. No analytics package, cookies or API keys are included in this static page.

## Payment status
Stripe Jedras Digitalstudio is currently Sandbox-only. A test £0.99 product and price exist but are not wired to this hub. To enable live purchases, implement server-side Checkout Session creation, webhook signature verification, order fulfillment and secure access to purchased results; test those in Sandbox and obtain the owner's approval for Live and consumer disclosures. Do **not** unlock a premium feature based solely on a success URL or expose Stripe secret keys in this repo.
