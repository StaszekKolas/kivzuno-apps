# Corporate Chaos — S01E05 THE URGENT TICKET (owner-review handoff)

**Produced:** 2026-10-27. **Status:** HOLD. **Incremental cost:** £0.

## Story continuity
E04 ends with KIV locked out after an impossible password reset. E05: KIV files a critical IT support ticket; queue says 14 business days. Fast-track requires another ticket. Tracking requires the broken login. Support closes the case as USER INACTIVE. The next planned story remains E06 MANDATORY FUN; do not duplicate the E02 meeting or E04 password episode.

## Actual local review artifact (not committed)
- MP4: `KIVZUNO_Corporate_Chaos_S01E05_THE_URGENT_TICKET.mp4`
- 23.000 seconds, 720×1280, 24fps, H.264; **one AAC mono** soundtrack, no voiceover.
- Reproducible local source: `render_e05.py` (Pillow, NumPy and ffmpeg); nine-frame contact sheet and original mono WAV.
- The MP4 and QA source are delivered to the owner separately as a sandbox review package; **the GitHub PR does not contain the binary**.

## Local checks actually run
- `ffprobe` video and audio metadata: **PASS**.
- Full `ffmpeg -f null -` decode: **PASS**.
- Seven in-scene pairs of **decoded MP4 frames** 0.6 seconds apart show genuine motion: mean pixel differences **7.741, 1.906, 3.968, 6.344, 6.504, 8.692, 9.339** — **PASS**.
- `ffmpeg volumedetect`: mean **-30.8 dBFS**, max **-11.9 dBFS** — no measured clipping.
- Nine-frame visual contact sheet: legible English text, consistent white KIV, black screen face, cyan eyes and chest badge — **PASS (sampled frames)**.
- Original vector-like drawn shapes and original procedurally synthesized soundtrack; Lato font licensed **SIL OFL 1.1** (local Debian copyright file).
- **NOT RUN:** independent QA, actual iPhone playback, whole-video subjective audio review, GitHub CI. No claim of publication or end-to-end app QA.

## Metricool latest *actual* posts, read-only on 2026-10-27
- Instagram Reel **E04**: 2026-10-26 13:02:30. Next public candidate: *verified live free miniapp promotion*, not E05 automatically.
- Facebook Reel **E03**: 2026-10-25 09:11:55. Next candidate: verified live miniapp promotion.
- TikTok video **E03**: 2026-10-25 09:12:47. Next candidate: verified live miniapp promotion.
- Miniapp live functionality and click-through **NOT RUN** this production pass. Do not advertise an unverified app.

## Independent QA and release gate
Play the actual MP4 with sound; check each scene and all text transitions on mobile, duplicate audio, first-second hook, final punchline, character continuity and rights. Owner separately decides on posting, scheduling, merging, deploying, outreach and any costs. **No publishing, scheduling, merge, deploy, Runway/API usage, paid generation, ads or outreach was performed.**

**E05 draft caption, English only:** "🚨 URGENT TICKET. 14 BUSINESS DAYS. 🤖 KIV can't log in. To track his support ticket? He has to log in. CORPORATE CHAOS — S01E05: THE URGENT TICKET. #KIVZUNO #CorporateChaos #OfficeHumor #ITSupport #WorkComedy"
