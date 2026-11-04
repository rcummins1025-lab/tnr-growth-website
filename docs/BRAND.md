# Brand — Service Momentum

## Names

| Name | Where it appears |
| --- | --- |
| **Service Momentum** | Everywhere a visitor looks: titles, header, copy, share card. |
| **T&R Growth LLC** | Only as the legal operator: the Privacy, Terms and SMS Consent pages, the two consent checkboxes (A2P-registered wording), the footer fine print ("Service Momentum is operated by T&R Growth LLC"), and `legalName` in the JSON-LD. |

`scripts/validate.mjs` fails if T&R/TNR branding shows up anywhere else.

The domain (`tnrgrowthagency.com`) and email (`hello@tnrgrowthagency.com`) are
unchanged. Moving them is a planned change; see `LAUNCH-CHECKLIST.md`.

## Who we talk to

Owner-run home-service shops with repeat customers: HVAC, mini-split, heating,
plumbing and similar, running **1 to 5 trucks**. Describe them by trade and
truck count. **Never call them "small"** (the validator checks).

Service Momentum is **not** a CRM, **not** an ads agency, and **not** self-serve
software. It is setup plus monthly, done for you: we hold the customer book,
track every lead by source, and bring past customers back when they're due.

## Logo

The SM logo from the video ads (source file `Service-Momentum-sm-mark.png`),
redrawn as clean vector paths:

| File | Use |
| --- | --- |
| `assets/sm-logo.svg` | The logo itself, transparent background |
| `favicon.svg` | Logo on a white rounded tile |
| `assets/apple-touch-icon.png` | 180×180, logo on white |
| `assets/sm-logo-512.png` | 512×512, logo on white (structured data) |
| `assets/og-image.png` | 1200×630 share card |

Colours: S `#2C5A9F`, M `#3285FC`. On dark backgrounds the logo sits on a white
rounded tile, the same way the ads show it. The product name beside it is HTML
text. Don't recolour, stretch or rebuild it.

## Look and feel

A trade brand, not a startup template. White and steel-gray grounds with navy
ink, two navy bands for contrast, heavy tight headlines, uppercase labels in
ruled boxes, and hard 2px rules instead of glows, gradients and icon cards.
Each section uses a different layout. The product mock-ups are the stars:
big, detailed, and full of believable example data. Real scenes come from
stills of the multi-truck ad (`media/scenes/`).

## Colour

From the ads' Remotion theme (`theme.ts`). Every value is a `--sm-*` token at
the top of `styles.css`; nothing below that block may hard-code a hex.

| Token | Hex | Use |
| --- | --- | --- |
| `--sm-white` / `--sm-steel` | `#FFFFFF` / `#E9EDF3` | Page grounds |
| `--sm-navy` | `#0A1430` | Ink, rules, dark bands |
| `--sm-navy-deep` | `#050B1D` | Footer |
| `--sm-blue-strong` | `#1F6FEB` | Buttons and highlighted words on white |
| `--sm-blue` | `#3B8CFF` | Highlighted words on navy |
| `--sm-text` / `--sm-text-2` | `#0A1430` / `#3C4A66` | Text on white |
| `--sm-paper` / `--sm-ink` | `#F6F8FC` / `#0E1A36` | Product mock-ups |

Retired, and blocked by the validator: the Forge palette (charcoal `#171A1F`,
orange `#D9653B`, canvas `#F4F0E6`) and the earlier navy/gold palette.

## Type

System UI stack: SF Pro on Apple devices (what the ads use), then Segoe UI /
Roboto. No web-font download (the privacy policy says only the host sees
visitors' IPs, so fonts are not loaded from Google). Headlines are 900 weight
with tight tracking; one or two words per headline go blue, like the ads. A
self-hosted condensed face (for example Barlow Condensed, SIL OFL) would push
the trade feel further; it needs the font files added to the repo.

## Copy rules

- Simple words. One idea per section.
- No pricing anywhere.
- No invented statistics in the copy. Numbers live only inside the product
  mock-ups.
- Mock-ups are never blank: no dashes, no "Sample" labels, no empty states.
  Fill every screen with made-up names and realistic numbers so it looks like
  a busy shop, and put a small "Example data" note at the bottom of each one.
  The validator checks all of this.
- No client names, quotes or numbers until the owner approves them in writing.
  The case-study section stays off the page until then.
- Don't promise automatic texting of a client's customers. The owner reviews
  the drafted text and taps send.
