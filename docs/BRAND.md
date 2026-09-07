# Brand architecture

## The two names

| Name | Role |
| --- | --- |
| **ServiceMomentum** | The **customer-facing product name** of the connected customer-growth system. |
| **T&R Growth LLC** | The **company** that designs, installs, operates, and supports the system. |

Lockup used across the site: **ServiceMomentum — by T&R Growth**, tagline
**“From first search to next service.”**

> **⚠️ Working name — not legally finalized.** "ServiceMomentum" is a working
> product name. **Domain availability and trademark clearance are still required
> before any public launch, product-domain purchase, or paid marketing.** Until
> then, keep the name easy to change (see below) and do not register a
> ServiceMomentum domain or email.

## Operational domain and email (do not change without approval)

- **Website / domain:** https://tnrgrowthagency.com  (repo `CNAME` = `tnrgrowthagency.com`)
- **Email:** hello@tnrgrowthagency.com
- The site intentionally uses the existing T&R Growth operational domain and
  email. There is **no** ServiceMomentum domain or email, by design.

## How to change the working product name (centralized)

The product name is a single, unique token, kept in **`brand.config.json`** and
wrapped in the markup as `data-brand="product"` spans. The brand symbol beside it
carries **no letters**, so a rename never touches artwork. To rename everything
in one step:

```bash
# Preview how many occurrences would change:
node scripts/apply-brand.mjs --check

# Rename ServiceMomentum -> NewName across all HTML + js/site-config.js + config:
node scripts/apply-brand.mjs --to "NewName"
```

Then re-run `node scripts/validate.mjs` and re-check the preview. The script does
**not** touch the domain, email, or CNAME.

Three name-derived forms are rewritten together, so a rename leaves nothing
behind:

| Form | Example | Where |
| --- | --- | --- |
| The name | `ServiceMomentum` → `NewName` | HTML, JS, config, docs |
| Lowercase slug | `servicemomentum-site` → `newname-site` | `package.json`, form `_source` |
| Uppercase wordmark | `SERVICEMOMENTUM` → `NEWNAME` | `assets/og-image.svg` |

There is no fourth form, because there are no initials in the markup any more:
the retired `SM` badge was replaced by the letter-free symbol, and
`scripts/validate.mjs` fails if an initials badge is ever reintroduced.
It also fails if any shipped file still contains the old name in any casing. The
runtime config global is `window.TNR_CONFIG` — named after the company, not the
working product name, so it never goes stale.

Other brand values (tagline, positioning, colors, email, form endpoint) also live
in `brand.config.json`; colors are mirrored as CSS custom properties at the top
of `styles.css`, and the form endpoint is mirrored in `js/site-config.js`.

## The brand symbol (PROVISIONAL)

> **⚠️ The symbol is provisional.** It is approved as a working mark only, and
> stays provisional until "ServiceMomentum" clears **trademark and domain
> checks**. Do not file, register, or use it externally — business cards, vehicle
> wraps, ads, app stores, third-party profiles — until that clearance lands.
> Every mark file is labelled `PROVISIONAL` in its `<desc>`, and
> `scripts/validate.mjs` fails if that label is removed.

**Concept.** An asymmetric four-stage **open loop**: an organic pathway that
carries four stages and never closes. The accent stage sits at the far end of the
pathway, where momentum has carried it — the cycle that keeps going rather than
closing on itself. It reads as a system, not as a letter, and not as a spinner.

**No letterforms.** The symbol does not depend on S, M, or any initial. That is
deliberate: the product name is provisional, so nothing name-shaped is allowed
into the artwork, and `apply-brand.mjs` never has to touch a graphic. The
wordmark beside it is always **HTML text** (`.brand-name`), never drawn.

## The Forge palette

The approved brand direction. **These six are the only brand colours**; the
`--forge-*` custom properties at the top of `styles.css` are the single source of
truth, and `brand.config.json` → `theme` mirrors them.

| Name | Hex | Used for |
| --- | --- | --- |
| **Forge Black** | `#171A1F` | Dark grounds, body text, the logo pathway, primary button text |
| **Warm Canvas** | `#F4F0E6` | Light bands, the audit ground |
| **Burnt Orange** | `#D9653B` | The single accent: logo endpoint, progress bar, primary button fill, rules |
| **Steel Blue-Gray** | `#5E7184` | Secondary UI, icons |
| **Concrete** | `#D8D6CF` | Borders, hairlines |
| **White** | `#FFFFFF` | Surfaces, reversed pathway |

**Derived shades** (also centralized in that block) exist only for depth and
contrast — panel tones on dark, and text shades that clear WCAG AA:

- `--forge-orange-text` `#A94A21` — Burnt Orange is only **3.6:1** on white, so
  small orange **text** uses this instead (**5.7:1** on white, **5.0:1** on Warm
  Canvas). Burnt Orange itself is for fills, rules, and large type.
- `--forge-steel-text` `#55677A` — muted text, **5.1:1** on Warm Canvas.
- The **primary button is Forge Black on Burnt Orange (4.9:1)**. White on Burnt
  Orange is 3.6:1 and fails — `scripts/validate.mjs` enforces this.

**Retired — must never return.** Service Navy `#102A43`, Momentum Amber
`#E0A526`, and the whole previous navy/gold set are listed in
`scripts/brand-lib.mjs` → `RETIRED_COLORS`. Validation fails if any of them
reappears in a shipped file, and fails if **any** hard-coded hex appears in
`styles.css` below the palette block.

**Colours in the mark.** A **Forge Black pathway** (white when reversed) and
exactly one **Burnt Orange endpoint**. Mirrored as `--brand-navy` /
`--brand-amber` in `styles.css` (names kept so the rename tooling is untouched)
and as `productMark` in `brand.config.json`. No other colour may appear in a mark
file.

**Geometry** (viewBox `0 0 64 64`, all values literal — nothing traced). The loop
is **not a circle**: the radius varies with angle, so the silhouette is an organic
pebble rather than a status/loading ring. The pathway is a Catmull-Rom spline
through these polar samples, emitted as cubic Béziers, drawn in the order the
path travels them:

| Angle | Radius | |
| --- | --- | --- |
| `55°` | `19.6` | **stage 1** — r `6.0`; the path **starts** inside this node |
| `80°` | `20.5` | |
| `110°` | `21.2` | widest of the lower-left bulge |
| `132°` | `20.9` | |
| `157°` | `20.1` | **stage 2** — r `6.9`, the heaviest node |
| `186°` | `18.9` | |
| `216°` | `18.1` | |
| `250°` | `17.7` | tightest point |
| `274°` | `17.9` | |
| `292°` | `18.4` | **stage 3** — r `5.9` |
| `316°` | `19.8` | |
| `334°` | `21.2` | the tail flares outward |
| `350°` | `22.8` | **stage 4** — r `6.6`, Burnt Orange; the path **ends** inside it |

Loop centre `(30.17, 31.58)`, stroke `6.4`, round caps.

**Every stage sits on the pathway.** The curve begins inside stage 1 and
terminates inside the accent stage, with round caps hidden under both nodes — so
no node floats free, and the accent reads as where the pathway *arrives*, not as
a detached dot. The opening is the `65°` span between the accent stage and stage
1, on the right: the loop deliberately never closes.

The asymmetry lives in the varying radius and in the node angles and radii — it
is not a rotationally symmetric ring, and it is not a circular arc.

**Variants.**

| File | Use |
| --- | --- |
| `assets/mark.svg` | Primary — Forge Black pathway, Burnt Orange endpoint. Light surfaces. |
| `assets/mark-mono.svg` | One colour — everything inherits `currentColor`. Single-ink print, stamps, any surface that cannot carry the accent. |
| `assets/mark-reversed.svg` | Reversed — white pathway, Burnt Orange endpoint. Forge Black and other dark surfaces. |
| `favicon.svg` | Reversed mark on a Forge Black tile — identical geometry, scaled to `0.88` inside the tile. |

**Not allowed in the artwork:** gradients, shadows, glow, arrows, houses, tools,
AI motifs, raster/traced art, and any `<text>`. `scripts/validate.mjs` checks all
of these, plus that no `<image>`, `data:` URI, base64 payload, or external
reference has crept in.

**Sizing.** The lockup uses `.brand-mark` at 38px in the header and 32px in the
footer, with `width`/`height` set on the `<img>` so the space is reserved before
the file loads and the mark can never shift the layout. Verified legible at 16,
24, and 32px.

## Claim limitations (pilot implementation)

The working-implementation section must only make **currently supported**
claims. `scripts/validate.mjs` scans for banned phrases, but wording still needs
human review. Keep it accurate:

**Supported / allowed:**
- T&R Growth built the pilot business's focused service website.
- The website is connected to a private lead-management dashboard that tracks
  leads and job status.
- A Google review-request workflow has been implemented.
- Future service dates / due-for-service records can be tracked.
- An eight-unit commercial mini-split cleaning job was completed.
- “A commercial customer reported finding the pilot business after asking
  Gemini for a local service company of that kind.”
- “In a separate unbranded test, Gemini displayed the business first and cited
  the website as its source. Results can vary by query, user, and location.”

**Not allowed (do not claim):**
- That T&R Growth scaled the pilot business's revenue, or any revenue figure.
- That the business always ranks first in Gemini, or that placement is guaranteed.
- That the website definitively caused the commercial job (keep the Gemini
  discovery and the commercial job as **separate** observations).
- That the Google review is publicly live before it is verified.
- That automated customer SMS is active, or that the system is a full CRM /
  scheduling / invoicing / dispatch platform.
- That multiple clients are already using it.
- That the commercial facility was a cannabis business.

Label the section as an **active pilot**, not a finished scaling case study.

## Future product-domain & email considerations (when the name is cleared)

Only after trademark + domain clearance and explicit approval:

- **DNS:** A future `servicemomentum.com` (or similar) could either (a) redirect
  to `tnrgrowthagency.com`, or (b) become the primary host with canonical URLs
  updated. Do **not** change existing `tnrgrowthagency.com` DNS or the GitHub
  Pages custom domain without a deliberate migration plan (see
  `docs/LAUNCH-CHECKLIST.md`).
- **Email:** A future `hello@servicemomentum.com` would be an **alias/forward**
  to the existing mailbox, set up in the email provider — not a new standalone
  account. Update `brand.config.json` `email` and re-run the brand notes review.
- Keep business name, URL, email, and any social profiles **consistent**
  everywhere for local + AI search trust.
