# KIVZUNO — controlled release: app → website → Buffer

## What we can verify today (2026-10-09)
- GitHub repository: `StaszekKolas/kivzuno-apps`; deploy configuration in `netlify.toml` publishes `hub/` and functions from `netlify/functions/`.
- Netlify GitHub deployment preview checks were **successful** on PR #1 (Same Brain?) and PR #3 (Buffer connectivity). This confirms Netlify can build preview deployments from this repository.
- Whether Netlify **production** follows every change to `main` has **NOT** been independently verified. No Netlify account-management connector is available in this conversation. A successful PR preview is not proof of a production deployment.
- `Same Brain?` is open in PR #1 and **not** on `main`. `Locked In` is open in PR #2 with its base set to the **Same Brain feature branch**, not `main`; review/rebase it after #1. Neither app should be promoted as publicly available yet.
- The October 9 Buffer-approved `Panic Button for Adults` campaign used `src=ig_reel`, `src=fb_reel`, and `src=tiktok`. The old public source code did not accept Facebook/TikTok source tags: a pending change in this release-gate PR adds them to both the client and Netlify function, without collecting personal data.

## One-time Netlify production-link verification (human, read only)

In the Netlify dashboard for site `kivzuno-hub`, check:
1. **Site configuration → Build & deploy → Continuous deployment**: linked GitHub repo `StaszekKolas/kivzuno-apps`.
2. Production branch **`main`**; repository root as base, published directory **`hub`**, functions **`netlify/functions`**. Compare with `netlify.toml`.
3. **Deploys → Production deploys**: latest completed production deploy has the expected `main` commit SHA and a successful status. If not, stop; do not advertise newly merged apps.
4. Check the free-plan status; do not enable paid add-ons, automatic credit top-ups, paid builds, or external domains.

Do not change the connection, deploy settings or billing without the owner's explicit approval.

## Per-app release sequence

1. Agent `KIVZUNO | Produkty` proposes one app; the owner approves the app concept separately before implementation.
2. Work happens on a feature branch and Draft PR; no automatic merge to `main`.
3. Source tests in `scripts/site-release-gate.mjs` and `tests/site-release-gate.test.mjs` validate playable cards, router branches, JavaScript syntax, Netlify configuration, and event-source app allowlists. The CI workflow runs on app/Netlify PR changes **without secrets, deployments or posting**.
4. Review Netlify **Deploy Preview** and manually test on phone/desktop. Run through every question; test replay, back/home, share/copy, deep link, reduced-motion where relevant, disclosures and absence of any real payment request. Same Brain requires testing both halves of the friend challenge with two devices/browser sessions. Tests of only the page HTML do not prove interactive gameplay.
5. The owner expressly approves merging the reviewed PR. App PRs with non-`main` bases must be updated in order before merging.
6. Verify production deploy SHA in Netlify matches `main`, **then** use GitHub Actions `KIVZUNO app release verification` → `Run workflow` → branch `main`, set `verify_live=true` and select the released app slug. This performs a read-only HTTP test of the public site to confirm card, router and JavaScript are present. Re-check mobile functionality manually.
7. Record **DEPLOYED VERIFIED** with URL `https://kivzuno-hub.netlify.app/#<slug>`, verified date, Netlify deploy identifier or Git commit, and any exceptions in the PR or issue. The `KIVZUNO | Buffer + marketing` agent must treat PR approval or merging alone as **not enough** for promotion.
8. Only after DEPLOYED VERIFIED, the marketing agent can prepare approved media/captions. Before posting, check that all 3 Buffer queues do not already contain the campaign, verify the media URLs and supported API fields, use only Free-plan features, and verify platform `sent` state (not merely `sending`). A new social publishing authorization must be explicit and scoped.

## Safety and limitations

- No direct Netlify administration permissions, live writes, automatic PR merges, paid advertising, Stripe Live, or upgrades are introduced by these scripts.
- Neither a preview build nor the read-only public site probe is an end-to-end browser test.
- Netlify production publishing may be automatic **only when its settings really link the repository's `main`**; until verified, require manual confirmation.
- Existing external Chaos Quiz / Excuse-O-Matic sites are separate Netlify sites. Their update status cannot be inferred from the KIVZUNO hub repo.
- Source parameters and conversion counters are aggregated events, not unique visitors or sales.
- If something fails, do not blindly rerun publishing workflows; diagnose and avoid duplicates.
