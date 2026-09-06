# Launch checklist — ServiceMomentum rebrand

This build is a **local/staging preview**. It has **not** been deployed. Nothing
here changes DNS, GitHub Pages, HTTPS, Google Workspace, or Twilio.

## 🚫 Launch blockers (must resolve before deploy)

1. **Contact-form endpoint — wired; awaiting Ryan's confirmation.** The
   submission path is built and tested — both encodings, the spam trap, the
   endpoint safety check, the 20s timeout, and provider error surfacing, all
   verified against `npm run mock`. **The dedicated Formspree endpoint is set in
   `js/site-config.js`** (`formEndpointMode: "formspree"`), and **one real local
   end-to-end submission returned an HTTP success response**.

   What remains is confirmation only, and only Ryan can do it:
   - The submission **appears in the Formspree dashboard**.
   - The notification **reached `hello@tnrgrowthagency.com`**. A new Formspree
     form often withholds forwarding until the recipient address is verified —
     look for a confirmation email first.

   **Further live submissions require explicit approval.** Use the local mock for
   all other testing, and when finished restore the **real endpoint** — never
   `""`, which would silently disconnect the live form. Enable Formspree's domain
   restriction for `tnrgrowthagency.com` only *after* both confirmations; earlier
   it would reject localhost tests. See `docs/CONTACT-FORM.md`.
2. **Product-name clearance.** "ServiceMomentum" is a **working name**. Complete
   **trademark clearance and domain availability checks** before public launch or
   any paid marketing. See `docs/BRAND.md`.
3. **Brand symbol is PROVISIONAL.** The open-loop mark in `assets/mark*.svg` and
   `favicon.svg` is approved as a working symbol only. It stays provisional until
   the product name clears trademark and domain checks — the symbol carries no
   letters, so it survives a rename, but do **not** file, register, or use it
   externally (business cards, vehicle wraps, ads, app stores, third-party
   profiles) until clearance lands. See `docs/BRAND.md`.
4. **OG image raster.** `assets/og-image.svg` exists, but some platforms
   (Facebook/LinkedIn) don’t render SVG social images. Export a **1200×630 PNG**
   (`assets/og-image.png`) and update the `og:image` / `twitter:image` URLs.

## ✅ Pre-deploy review

- [ ] `node scripts/validate.mjs` passes.
- [ ] Legal review of `privacy.html` (now discloses the form) and that the SMS
      program wording in `privacy.html` / `terms.html` / `sms-consent.html` is
      unchanged and still accurate.
- [ ] Gavin-pilot section re-read against `docs/BRAND.md` claim limits.
- [ ] Confirm the completed live test in the Formspree dashboard **and** in the
      `hello@tnrgrowthagency.com` inbox. (The submission itself is already done —
      do not send another without approval.)
- [ ] Confirm `CNAME` still contains exactly `tnrgrowthagency.com`.
- [ ] Re-check mobile (320 / 375 / 390), tablet, and desktop; no console errors.
- [ ] Check the brand symbol at 16 / 24 / 32px (favicon and header lockup).

## Deployment (unchanged from current setup)

The site deploys via **GitHub Pages from `main` / root** (static files, no build
step required — the `package.json` scripts are dev tooling only). Standard flow:

1. Open a PR from the working branch into `main`; review.
2. Merge to `main`; GitHub Pages rebuilds automatically.
3. Verify production at https://tnrgrowthagency.com and the github.io URL.

No deploy should happen until the blockers above are resolved and approved.

## Future product-domain (only after name clearance + approval)

- **DNS:** decide whether a future product domain redirects to
  `tnrgrowthagency.com` or becomes primary (with canonical URLs migrated). Plan a
  redirect map; don’t break existing indexed URLs. Do not alter existing
  `tnrgrowthagency.com` DNS without a migration plan.
- **Email alias:** add `hello@<product-domain>` as a **forward/alias** to the
  existing mailbox in the email provider; do not create a separate account.
- Keep name, URL, email, and social profiles consistent (local + AI search
  trust). Update `sitemap.xml`, canonicals, and `brand.config.json` together.

## SEO / AI-visibility notes

AI-assistant visibility here is treated as **accurate business information,
useful content, structured data, crawlability, and consistency** — never as a
guarantee or a trick. Structured data is accurate `Organization` + `WebSite`
JSON-LD with **no** `aggregateRating`/review markup. `robots.txt` allows all
reputable crawlers and points to `sitemap.xml`.
