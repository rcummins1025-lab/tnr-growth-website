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

## Colour

From the ads' Remotion theme (`theme.ts`). Every value is a `--sm-*` token at
the top of `styles.css`; nothing below that block may hard-code a hex.

| Token | Hex | Use |
| --- | --- | --- |
| `--sm-navy-deep` | `#050B1D` | Page background |
| `--sm-navy` | `#0A1430` | Section lift, cards |
| `--sm-navy-lift` | `#13224A` | Card highlight |
| `--sm-blue` | `#3B8CFF` | The one accent: highlighted words, eyebrows, bars |
| `--sm-blue-strong` | `#1F6FEB` | Button fill (white text passes 4.5:1) |
| `--sm-text` / `--sm-mute` | `#F3F6FC` / `#A9B4CC` | Text on navy |
| `--sm-paper` / `--sm-ink` | `#F6F8FC` / `#0E1A36` | Product mock-ups and the form |

Retired, and blocked by the validator: the Forge palette (charcoal `#171A1F`,
orange `#D9653B`, canvas `#F4F0E6`) and the earlier navy/gold palette.

## Type

System UI stack: SF Pro on Apple devices (what the ads use), Inter where
installed, then Segoe UI / Roboto. No web-font download. Headlines are heavy
(800) with tight tracking; one or two words per headline go blue, like the ads.

## Copy rules

- Simple words. One idea per section.
- No pricing anywhere.
- No invented statistics. Product mock-ups use fake data and are labelled
  "Sample data"; the validator checks every one.
- No client names, quotes or numbers until the owner approves them in writing.
- Don't promise automatic texting of a client's customers. The owner reviews
  the drafted text and taps send.
