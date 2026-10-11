# Service Momentum — website

Marketing website for **Service Momentum**, a done-for-you agency that installs
and runs the Command Center for home-service businesses with repeat customers
(HVAC, mini-split, heating, plumbing and similar; owner-run shops with 1 to 5
trucks). Service Momentum is operated by **T&R Growth LLC**, which is named only
on the legal pages, in the A2P SMS consent wording, and in the footer fine print.

- **Domain:** https://tnrgrowthagency.com (`CNAME` = `tnrgrowthagency.com`, unchanged)
- **Email:** hello@tnrgrowthagency.com
- **Headline:** _Your past customers are calling someone else._

## Stack

Plain static **HTML + CSS** with two small scripts, deployed as-is from the repo
root via **GitHub Pages**. No framework, no build step, no web fonts, no
analytics, no cookies. The `package.json` scripts are dev tooling only.

## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Home page: hero (video loop), problem, how it works, what you get, video, case-study placeholder, FAQ, Book a demo form |
| `contact.html` | Book a demo page (same form; old links and `?source=` links keep working) |
| `privacy.html` / `terms.html` / `sms-consent.html` | Legal pages. A2P SMS wording preserved |
| `styles.css` | All styles. Every colour is a `--sm-*` token in the `:root` block at the top |
| `js/site-config.js` | **One place** to set the form `formEndpoint` / `formEndpointMode` |
| `js/demo-form.js` | Demo form validation and submission |
| `js/site.js` | Hero video pause/play, reduced motion, scroll reveal |
| `media/` | Web-compressed videos and their poster images |
| `assets/` | SM logo (SVG), share image, icons |
| `favicon.svg` | SM logo on a white tile |
| `brand.config.json` | Brand source of truth (name, logo colours, palette, audience) |
| `scripts/validate.mjs` | Site checks (run before every merge) |
| `scripts/preview.mjs` | Local preview with a built-in form mock |
| `scripts/mock-endpoint.mjs` | Stand-alone dev-only form endpoint mock |
| `scripts/apply-brand.mjs` | Rename the product in one command |
| `_config.yml` | Keeps dev tooling and internal docs out of the GitHub Pages build |
| `docs/` | Brand, contact form, launch checklist |

## Local preview

```bash
npm run serve
```

Then open <http://127.0.0.1:8000>. The demo form posts to a local mock there,
never to Formspree. Add `?qa=error` or `?qa=timeout` to test failures. Check
390px and desktop widths.

## Checks

```bash
npm run validate
```

Covers structure, links, JSON-LD, the brand (SM logo, ads palette, no TNR
branding outside the legal operator lines), honest copy (no pricing, no
"small", no invented stats, sample data labelled, no client names), the demo
form's safeguards and A2P consent wording, video size budgets and autoplay
rules, colour contrast, and the GitHub Pages surface. Exits non-zero on failure.

## Videos

Source renders live outside this repo
(`BizWorkFlow/output/service-momentum-scale-ad/`). Only the multi-truck ad is
used, because the other Service Momentum renders show real client numbers or
internal account details.

| File | From | Notes |
| --- | --- | --- |
| `media/hero-loop.mp4` | `SM-Scale-Ad-Clean.mp4`, 10.25s to 23.75s | 720×1280, no audio, ~0.4 MB, autoplays muted with a pause button |
| `media/vsl.mp4` | `SM-Scale-Ad-Captioned.mp4`, full 32s | 720×1280, AAC 96k, ~2 MB, click to play, captions burned in |

Re-encode with:

```bash
ffmpeg -ss 10.25 -i SM-Scale-Ad-Clean.mp4 -t 13.5 -an -vf "scale=720:1280:flags=lanczos,format=yuv420p" -c:v libx264 -profile:v high -preset veryslow -crf 30 -movflags +faststart -map_metadata -1 media/hero-loop.mp4
ffmpeg -i SM-Scale-Ad-Captioned.mp4 -vf "scale=720:1280:flags=lanczos,format=yuv420p" -c:v libx264 -profile:v high -preset veryslow -crf 27 -c:a aac -b:a 96k -movflags +faststart -map_metadata -1 media/vsl.mp4
```

## Deployment (GitHub Pages, from `main` / root)

Nothing here deploys automatically from a branch. Merging to `main` publishes.

1. Review the PR. Run `npm run validate`.
2. Merge to `main`. GitHub Pages rebuilds in a minute or two.
3. Check https://tnrgrowthagency.com on a phone and a laptop.

Custom domain, DNS and HTTPS are already configured for `tnrgrowthagency.com`.
**Do not change them** without a migration plan. See
[`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md).
