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
3. Check https://tnrgrowthagency.com and the share card (paste the URL into a
   text or Slack to see `assets/og-image.png`).

Rollback: revert the merge commit on `main`; Pages rebuilds the old site.

## Later: a Service Momentum domain (needs your OK)

The site still lives on `tnrgrowthagency.com` and emails go to
hello@tnrgrowthagency.com. Moving to a Service Momentum domain means: buying
the domain, pointing its DNS at GitHub Pages, changing `CNAME`, updating every
canonical URL, `sitemap.xml`, `og:url`, `brand.config.json`, the email address,
and the A2P registration's website field, and redirecting the old domain. Do it
as one planned change, not piecemeal.

## SEO notes

Structured data is accurate `Organization` and `FAQPage` JSON-LD with **no**
rating or review markup. `robots.txt` allows reputable crawlers and points to
`sitemap.xml`.
