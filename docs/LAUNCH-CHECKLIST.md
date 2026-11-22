# Launch checklist — Service Momentum site

The rebuild lives on a branch and is **not deployed**. Nothing here changes DNS,
GitHub Pages settings, HTTPS, Formspree, Google Workspace or Twilio.

## Before you merge

- [ ] `npm run validate` passes.
- [ ] Read the home page on your phone and laptop (use the PR's preview link).
- [ ] **Legal wording.** The only legal edits are renames of the form
      ("Growth System Audit" → "demo request form"), the list of fields the
      form collects in `privacy.html`, and the "Last updated" date. Confirm
      those still match your A2P campaign's opt-in description. If the
      campaign names the "Growth System Audit form", update it in Twilio.
- [ ] **SMS consent wording** on the form is unchanged, word for word, and
      still says "T&R Growth / ServiceMomentum" because that is what A2P
      registered. Change it only after updating the A2P registration.
- [ ] **Formspree.** The endpoint is unchanged. New submissions arrive with
      different fields (`trade`, `trucks`) and the subject line
      "Service Momentum: Demo request: …". Confirm the first real one lands in
      the dashboard and in hello@tnrgrowthagency.com.
- [ ] **Case study.** There is no case-study section on the page. Add one
      (there's a marked slot in `index.html`) only with real numbers and the
      owner's written OK.
- [ ] **Video.** The site uses the website cut of the multi-truck ad, which
      ends on "More jobs from the customers you already have." The Instagram
      version still ends on "DM 'show me'" and is unchanged.

## Go live

1. Merge the PR into `main`.
2. GitHub Pages rebuilds automatically (a minute or two).
3. Check https://servicemomentumsystems.com and the share card (paste the URL into a
   text or Slack to see `assets/og-image.png`).

Rollback: revert the merge commit on `main`; Pages rebuilds the old site.

## Main domain: servicemomentumsystems.com

`CNAME`, canonical URLs, `og:url`, `sitemap.xml`, `robots.txt`,
`brand.config.json` and the JSON-LD use https://servicemomentumsystems.com.
The email stays hello@tnrgrowthagency.com. Order matters:

1. Point servicemomentumsystems.com at GitHub Pages (A/AAAA records, www CNAME)
   before merging, so the new custom domain resolves.
2. Merge. Confirm Settings > Pages shows servicemomentumsystems.com, then turn
   on Enforce HTTPS once the certificate is issued.
3. Forward tnrgrowthagency.com and www to https://servicemomentumsystems.com
   (301). Leave every email and verification record on tnrgrowthagency.com alone.
4. If Formspree's domain restriction is on, add servicemomentumsystems.com.
5. Update the website / opt-in URLs on the A2P campaign if they name
   tnrgrowthagency.com.

## SEO notes

Structured data is accurate `Organization` and `FAQPage` JSON-LD with **no**
rating or review markup. `robots.txt` allows reputable crawlers and points to
`sitemap.xml`.
