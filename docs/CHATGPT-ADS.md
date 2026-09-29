# ChatGPT Ads landing page: `command-center.html`

One offer, one page: **the Command Center for home-service owners** (Day-1
customer book import, due-for-service list, every lead in one place).

- URL: `https://tnrgrowthagency.com/command-center.html`
- `noindex` and not in `sitemap.xml`: it is for paid traffic only.
- Form: name, mobile phone, business name, trade, city. It posts to the same
  Formspree endpoint as the audit (`js/site-config.js`), with
  `meta_source = servicemomentum-command-center-landing`, `meta_offer =
  command-center`, the ad's `utm_*` tags, and the subject
  `ServiceMomentum: Command Center walkthrough: <business>`.
- Thank-you panel: fixed text, shown only after a real 2xx from Formspree.
- There is no call button yet. The site has no published business phone
  number. The markup has a commented-out `tel:` button in the form card:
  add the number and uncomment it.

## Pixel install checklist (Ryan)

The pixel is **not installed**. The page has two inactive markers and loads
nothing from OpenAI. I could not read OpenAI's developer docs from the build
environment, so **no snippet here is written from memory**. Paste only what Ads
Manager shows you.

**Before you paste anything**
1. [ ] Update `privacy.html`. It currently says the site uses **no cookies,
   analytics or third-party tracking**. The OpenAI Ads pixel stores the ad
   click id (`oppref`) in a first-party cookie. Rewrite the relevant sentences
   and the meta description to disclose the ChatGPT Ads pixel on this landing
   page, what it collects, and for how long.
2. [ ] Decide whether you need a consent banner for the states you advertise
   in. This is a legal call, not a code one.

**In OpenAI Ads Manager**
3. [ ] Tools → Conversions: create or open the pixel for `tnrgrowthagency.com`.
4. [ ] Create a conversion event with type **Lead**, event name
   **`lead_created`**, attached to that pixel.
5. [ ] Copy two things exactly as shown: the **base pixel code**, and the
   **single line that fires `lead_created`**.

**In this repo (one PR)**
6. [ ] `command-center.html`: paste the base code on the line directly under
   `<!-- OPENAI-ADS-PIXEL:BASE ... -->` in `<head>`. Paste it only on this page,
   not site-wide.
7. [ ] `js/ads-events.js`: paste the `lead_created` line inside the `try` block,
   at `// OPENAI-ADS-PIXEL:LEAD_CREATED`. It already runs **once per page load,
   only after a successful submit**, and a pixel error can never break the
   thank-you screen.
8. [ ] `scripts/validate.mjs`: the validator fails on any external `<script
   src="https://...">`. Allow the OpenAI pixel host **for
   `command-center.html` only**, in the "no third-party scripts" check. Keep
   the other pages strict.
9. [ ] Run `npm run validate`, then open the PR.

**After it is live**
10. [ ] Open the page from a real ChatGPT ad click, or with a test `?oppref=`
    if Ads Manager offers one. In DevTools → Network, check the pixel loads.
11. [ ] Submit the form once with clearly labelled test data. **This is a live
    submission, so do it only with your own approval.** Check that one
    `lead_created` request fires after the thank-you panel appears, and none on
    a failed submit.
12. [ ] In Ads Manager → Tools → Conversions, confirm the event shows up and
    check its Event Quality Score.
13. [ ] Turn on Formspree's domain restriction for `tnrgrowthagency.com` if you
    have not already (see `docs/CONTACT-FORM.md`).

## Ad creatives (image + title + copy + URL)

Exported stills: `docs/ad-creative/command-center-still-{1,2,3}-1200x1200.png`.
They are 1:1 PNG, 1200×1200, fictional data, and labelled illustrative. They are
the same art as the three still slots on the page (`data-ad-creative="1..3"`),
so the ad and the landing page match. **Check the current image size, ratio and
character limits in Ads Manager's creative form before upload.** I could not
verify ChatGPT Ads' creative specs from here. If a different ratio is required,
re-export (below) with a new frame size.

| # | Image | Title | Copy | URL |
|---|---|---|---|---|
| 1 | `command-center-still-1-1200x1200.png` | Your customer book, imported day one | The Command Center for home-service owners. We import the customers you already have, and you check anything unclear. | `https://tnrgrowthagency.com/command-center.html?utm_source=chatgpt&utm_medium=paid&utm_campaign=command-center&utm_content=still-1` |
| 2 | `command-center-still-2-1200x1200.png` | See who is due for service | Past customers due for their next visit, from their last completed job. You decide who to contact. | `…&utm_content=still-2` (same base URL) |
| 3 | `command-center-still-3-1200x1200.png` | Know what needs you today | New leads, due customers and upcoming jobs in one Today screen on your phone. Set up by T&R Growth. | `…&utm_content=still-3` (same base URL) |

Copy rules carried over from the site: no prices, no guarantees, no results
claims, no automated-texting claim, and never name the pilot customer.

**Re-exporting the stills.** Serve the site (`npm run serve` or `python3 -m
http.server`), open `command-center.html`, and screenshot each
`[data-ad-creative="N"] .lp-still` at a 600×600 CSS frame with device scale
factor 2. That is how the committed PNGs were made (Playwright, headless
Chromium). No video is needed.

## Reusing the page for a Launch Pack (Kyle-style)

Copy `command-center.html` to a new file, for example `launch-pack.html`, and
change only these parts:
- the canonical and `og:url` URLs
- the eyebrow and `<h1>`
- `.lp-sub`
- the three `.lp-proof` items
- `<input name="meta_offer" value="...">` (it tags the submission)
- the three still titles and captions

Keep one offer per page, `noindex`, and leave it out of `sitemap.xml`. The
validator's landing checks are written for `command-center.html`, so copy that
block in `scripts/validate.mjs` for the new file.
