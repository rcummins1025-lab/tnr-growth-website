# ServiceMomentum — website (operated by T&R Growth LLC)

Marketing/acquisition website for **ServiceMomentum**, a connected
customer-growth system for established local-service businesses. ServiceMomentum
is the customer-facing product name; **T&R Growth LLC** is the company that
designs, installs, operates, and supports it.

> **ServiceMomentum is a WORKING product name — not legally finalized.** Domain
> and trademark checks are required before public launch. See
> [`docs/BRAND.md`](docs/BRAND.md) and [`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md).

- **Operational domain:** https://tnrgrowthagency.com (`CNAME` = `tnrgrowthagency.com`)
- **Email:** hello@tnrgrowthagency.com
- **Positioning:** _Turn your website and past customers into a repeatable growth system._
- **Tagline:** _From first search to next service._

## Stack

Plain static **HTML + CSS**, deployed as-is from the repo root via **GitHub Pages**.
The only JavaScript is `js/intake.js` (the multi-step audit form),
`js/site-config.js` (its config), and `js/motion.js` (the scroll/entry motion
layer) — self-contained, no libraries, no analytics, no tracking, no cookies. The `package.json` scripts are **dev tooling
only** (validation + brand rename); they are not required to build or serve.

## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Homepage (hero, problem, lifecycle, what’s included, system diagram, Gavin pilot, who it’s for, founding offer, FAQ, final CTA) |
| `contact.html` | "Growth System Audit" multi-step application form |
| `privacy.html` / `terms.html` / `sms-consent.html` | Legal pages (SMS program wording preserved) |
| `styles.css` | Forge palette — **all** brand tokens in the `:root` block at the top |
| `js/site-config.js` | **One place** to set the form `formEndpoint` / `formEndpointMode` |
| `js/intake.js` | Multi-step form logic + submission |
| `js/motion.js` | Motion layer (IntersectionObserver only; reduced-motion aware) |
| `brand.config.json` | **Single source of truth** for the working brand |
| `scripts/apply-brand.mjs` | Rename the product name in one command |
| `scripts/brand-lib.mjs` | Shared brand helpers (name slug, approved mark palette) |
| `scripts/validate.mjs` | Focused checks / tests |
| `scripts/mock-endpoint.mjs` | Dev-only local stand-in for the lead endpoint |
| `assets/mark*.svg` | Brand symbol — primary, one-colour, reversed (**provisional**) |
| `assets/` | T&R Growth logos, favicon, OG image |
| `robots.txt`, `sitemap.xml` | SEO |
| `docs/` | Brand, contact-form, launch checklist |
| `CNAME` | GitHub Pages custom domain (do not change) |

## Local development

No build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
# or: npm run serve
```

Then visit <http://localhost:8000>. Check desktop, tablet, and phone widths
(320 / 390). The contact form needs JavaScript (served files run it directly).

## Testing

```bash
npm run validate      # or: node scripts/validate.mjs
```

Checks structure, internal links + anchors, escaping, email consistency, JSON-LD
validity, absence of fake rating markup, the Gavin-pilot claim guardrails, the
SEO assets + `CNAME`, the brand symbol (present, drawn not embedded, approved
colours, letter-free, labelled provisional, no stale name in any casing), the
form's submission safeguards (the endpoint matches the approved one, a valid
`formEndpointMode`, no endpoint mirrored in `brand.config.json`, no focus steal
on load), and the
motion layer's reduced-motion and fail-open guarantees. Exits non-zero on failure.

## Change the product name

```bash
node scripts/apply-brand.mjs --check          # dry run
node scripts/apply-brand.mjs --to "NewName"   # rename everywhere
```

The rename covers three name-derived forms — the name, its lowercase slug, and
its uppercase wordmark (`assets/og-image.svg`) — so nothing is left behind. The
brand symbol carries no letters, so a rename never touches artwork. See
[`docs/BRAND.md`](docs/BRAND.md).

## Brand symbol

> **The symbol is PROVISIONAL** — approved as a working mark only, until
> "ServiceMomentum" clears trademark and domain checks. Do not register or use it
> externally before then.

An asymmetric four-stage **open loop**: an organic, varying-radius pathway in
Forge Black `#171A1F` carrying three stage nodes, ending inside a single Burnt
Orange `#D9653B` endpoint. Every stage sits **on** the path — it
starts inside stage 1 and terminates inside the accent — so nothing floats free,
and the loop never closes. It is a spline rather than a circular arc, so it does
not read as a loading ring. Hand-constructed SVG geometry — the full polar table
is written out in each file's `<desc>` — with no traced or embedded raster art,
no gradients, shadows, glow, arrows, or `<text>`. Variants:
`assets/mark.svg` (primary), `assets/mark-mono.svg` (one colour, `currentColor`),
`assets/mark-reversed.svg` (dark surfaces), and `favicon.svg` (reversed on a Forge
Black tile, optically weighted for 16px). The product wordmark next to it is always
HTML text, never baked into the artwork. See [`docs/BRAND.md`](docs/BRAND.md).

## Motion

`js/motion.js` adds entry and scroll motion that explains the system: the
connected-system path traces through its seven stages, the four lifecycle steps
arrive in order, the redacted dashboard sample walks New → Booked → Done → Due
(labelled as a sample; never presented as live data), and the case-study
timeline grows as milestones are reached. It is `IntersectionObserver` only —
no libraries, no scroll listeners, no parallax, no autoplay media, and only
`opacity`/`transform` change, so there is no layout shift.

Motion is gated on `<html class="motion">`, added by a small inline `<head>`
script **only** when JavaScript runs and `prefers-reduced-motion` is not
`reduce`. If `js/motion.js` never loads, that script removes the class again,
so no content can be stranded behind an animation.

## Contact form

The audit form posts only to `js/site-config.js` → `formEndpoint`, which is the
**single source of truth** — the endpoint is deliberately not mirrored anywhere
else. **The dedicated Formspree endpoint is wired** (`formEndpointMode:
"formspree"`), and one real local end-to-end submission returned an HTTP success
response.

**Still to confirm (Ryan):** dashboard receipt and delivery to
`hello@tnrgrowthagency.com`. **Further live submissions require explicit
approval** — use the local mock for everything else, and when a mock test is
finished restore the **real endpoint**, never `""`.

The path around it is finished and tested: `formEndpointMode` picks the encoding
(`json` or `formspree`), submissions carry non-reserved `meta_*` metadata plus
`_replyto`/`_subject` for a usable inbox, a hidden `_gotcha` spam trap stops bots
without transmitting anything, the endpoint is refused unless it is https (and
never the tenant-scoped client-booking backend), requests time out after 20s
instead of hanging, and a provider's own error message is shown to the visitor.

Exercise all of it without wiring anything real:

```bash
npm run mock          # local stand-in on http://localhost:8125/f/test
```

See [`docs/CONTACT-FORM.md`](docs/CONTACT-FORM.md).

## Deployment (GitHub Pages, from `main` / root)

The site is served statically from `main`. Nothing here pushes, deploys, or
changes DNS automatically.

1. Open a PR from your working branch into `main`; review.
2. Merge to `main`; GitHub Pages rebuilds automatically.
3. In **Settings → Pages**, source is _Deploy from a branch_ → `main` → `/ (root)`.
4. Verify at https://tnrgrowthagency.com and the `github.io` URL.

Custom domain and DNS are already configured for `tnrgrowthagency.com` — **do not
change them**. Resolve every item in [`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md)
before deploying the rebrand.

## Ownership

Content and branding are owned by T&R Growth LLC.
