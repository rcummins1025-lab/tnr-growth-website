# Demo request form integration

The **Book a demo** form appears on the home page (`index.html#book`) and on
`contact.html`. It is one short screen: name, business name, email, optional
mobile phone, trade, truck count, optional notes, and two consent boxes. The
logic lives in `js/demo-form.js`, self-contained, with **no third-party
libraries, no analytics, and no tracking**. (It replaced the eight-screen
Growth System Audit wizard and `js/intake.js` on 2026-10-11.)

## How submission works

The form **only** submits to `window.TNR_CONFIG.formEndpoint` (set in
`js/site-config.js`). Behavior:

| `formEndpoint` | What happens on submit |
| --- | --- |
| `"https://…"` (**current**) | The form POSTs the answers (encoded per `formEndpointMode`) and shows the **real** success or error returned by the endpoint. |
| `""` (empty) | The form validates the fields, then shows an **honest “not connected yet”** message and points the visitor to email. **Nothing is transmitted. Success is never faked.** This is the fallback behaviour, not the current state. |
### `formEndpointMode`

`formEndpointMode` selects how the body is encoded. It is **implemented** in
`js/demo-form.js`; an unrecognized value falls back to `"json"` and logs a console
warning. It only matters once `formEndpoint` is set, which it now is.

| Mode | Request | Use for |
| --- | --- | --- |
| `"json"` (default) | `Content-Type: application/json`, body `JSON.stringify(answers)` | A serverless function you control. |
| `"formspree"` | `FormData` body (browser sets `multipart/form-data`), `Accept: application/json` | Formspree and other form services: a CORS "simple" request, so no preflight, and no provider rejects the content type. |

## Endpoint status

**The dedicated Formspree endpoint is wired.** `js/site-config.js` is the single
source of truth:

```js
formEndpoint: "https://formspree.io/f/xqpklkny",
formEndpointMode: "formspree"
```

- **One real local end-to-end submission returned an HTTP success response** from
  Formspree (2026-09-05, from the local preview, with clearly-labelled test data).
- **Still unconfirmed by Ryan:** that the submission appears in the Formspree
  dashboard, and that the notification actually reached
  `hello@tnrgrowthagency.com`. A brand-new Formspree form commonly withholds
  forwarding until the recipient address is verified, so check for a
  confirmation email first.
- **Further live submissions require explicit approval.** Use the local mock for
  all other testing.
- Formspree's **domain restriction is intentionally still off** — turn it on
  (`tnrgrowthagency.com`) only after dashboard receipt and email delivery are
  confirmed, or it will reject localhost tests.

## Choosing an endpoint (the "environment variable")

`formEndpoint` is the one setting to configure. **Recommended: Formspree**
(https://formspree.io) or a small dedicated serverless function.

**Do NOT** point it at the existing client-booking backend
(`zentradesk-middleware`). That endpoint is tenant-scoped for *client
businesses’* customer bookings, derives its tenant from a **server-side secret**,
and must never receive a secret embedded in browser JavaScript. Mixing T&R’s own
agency sales leads into it would be a misuse and a security risk. A separate,
purpose-built agency-lead endpoint keeps the two streams cleanly isolated.

### What a submission contains

The form fields, plus four metadata fields. Note the naming: metadata
keys deliberately **do not** start with an underscore, because form services
reserve `_`-prefixed names (`_replyto`, `_subject`, `_cc`, `_next`, `_gotcha`,
`_format`) and quietly swallow or repurpose anything else that looks like one.

| Field | Value |
| --- | --- |
| `meta_product` | The current working product name. |
| `meta_source` | Derived slug: `servicemomentum-demo-form`. |
| `meta_page` | The page the form was sent from (`index.html` or `contact.html`). |
| `meta_submitted_at` | ISO timestamp. |
| `_replyto` | **formspree mode only** — the applicant's email, so replies go to them. |
| `_subject` | **formspree mode only** — e.g. `Service Momentum: Demo request: Acme Heating`. |

### Safeguards on the submission path

These are in `js/demo-form.js` and are covered by `scripts/validate.mjs`:

- **Endpoint safety check.** The endpoint must be an absolute **https** URL
  (plain `http` is allowed only for `localhost`, for the mock below), and the
  script refuses to post from an https page to a non-https endpoint. If the
  hostname or path matches `zentradesk`/`middleware`, it refuses outright — see
  the warning above. A refused endpoint shows *"This form is misconfigured"* and
  logs a specific reason to the console. **Success is never faked.**
- **Spam trap.** A hidden `_gotcha` input sits in the form, off-screen and out of
  the tab order. If it has a value, the submission stops silently and nothing is
  transmitted. Its value is stripped from the payload either way. Formspree also
  honours `_gotcha` server-side.
- **Timeout.** Requests abort after 20s via `AbortController`, so the button
  never stays stuck on "Sending…". The visitor is told it took too long and that
  the request was **not** sent.
- **Real error messages.** On a 4xx the provider's own
  `{"errors":[{"message"}]}` body is surfaced to the visitor rather than a
  blanket failure. The button re-enables so they can retry.

## Testing the path without wiring anything

`scripts/mock-endpoint.mjs` is a dependency-free local stand-in. It exists so the
real submission path can be exercised end-to-end **without creating a Formspree
account, wiring a live endpoint, or sending anyone's data anywhere.** It stores
nothing, and it is **never referenced or executed by the production website** —
no page links to it, and `scripts/validate.mjs` fails if one ever does.

> `_config.yml` excludes `scripts/`, `docs/`, and other development-only files
> from the GitHub Pages build. Source access is still possible wherever the
> repository is shared, so no source file may contain secrets, credentials,
> account identifiers, or personal data. The Formspree endpoint URL itself is
> not a secret (it ships in `js/site-config.js` and is visible in browser dev
> tools by design); the Formspree **account login** is, and never belongs here.

```bash
npm run mock          # serves http://localhost:8125/f/test
```

Easiest: run `npm run serve` (http://127.0.0.1:8000). That local preview points
the demo form at its own built-in mock without touching any file, and blocks
every outside request. Add `?qa=error` or `?qa=timeout` to the page URL to make
the mock fail.

Or set `formEndpoint` to `http://localhost:8125/f/test`, submit the form, and
watch the terminal — it prints the encoding and every field it received, and
warns if metadata is missing or the honeypot leaked. Every branch is reachable:

| Endpoint | Exercises |
| --- | --- |
| `http://localhost:8125/f/test` | success |
| `http://localhost:8125/f/test?fail=422` | provider field error, surfaced to the visitor |
| `http://localhost:8125/f/test?fail=500` | server error |
| `http://localhost:8125/f/test?slow=40` | the 20s client timeout |

**When you are done, set `formEndpoint` back to the real endpoint —
`https://formspree.io/f/xqpklkny` — not to `""`.** Leaving it empty
would silently disconnect the live form. `scripts/validate.mjs` fails if it is
left pointing at a local mock *or* if it drifts from the approved endpoint.

Better still: leave the file alone and override the endpoint in the browser
console for the duration of the test, so the committed configuration never
changes.

## Going live — what is done, what is left

**Done**
1. ~~Create the Formspree form and copy its endpoint.~~ Done.
2. ~~Set `formEndpoint` and `formEndpointMode` in `js/site-config.js`.~~ Done.
   The endpoint is **not** mirrored in `brand.config.json` — one source only.
3. ~~Submit one real end-to-end test.~~ Done once; it returned HTTP success.

**Left — Ryan only**
4. **Confirm the test submission appears in the Formspree dashboard.**
5. **Confirm the notification reached `hello@tnrgrowthagency.com`,** and verify
   the address in Formspree if a confirmation email is waiting.
6. Check that **Reply** goes to the applicant (`_replyto`) and the subject line
   is useful.
7. **Then** enable Formspree's domain restriction for `tnrgrowthagency.com`.
   Not before — it would reject localhost tests.
8. Re-check `privacy.html` against the processor's actual data handling — it
   discloses "a reputable third-party form-processing service".
9. Re-run `node scripts/validate.mjs`.

**Any further live submission needs explicit approval first.**

## Fields collected

This list must match the form in `index.html` and `contact.html`;
`scripts/validate.mjs` fails if a field goes missing.

| Field | Required |
| --- | --- |
| `name` | yes |
| `business_name` | yes |
| `email` | yes |
| `phone` | **optional** (required only while `sms_consent` is ticked) |
| `trade` | yes: HVAC, Mini-split, Heating, Plumbing, Other home service |
| `trucks` | yes: 1, 2 to 3, 4 to 5, 6 or more |
| `notes` (free text) | optional |
| `sms_consent` | **optional**, never pre-checked — submits `yes` or `no` |
| `contact_consent` | yes — "Consent is not a condition of any purchase." |
| `referral_source` | filled automatically, never shown or typed |

`referral_source` records where a visitor came from. A link such as
`contact.html?source=referral` submits `referral`; with no `?source=` it
submits `direct`. js/demo-form.js trims the value, caps it at 80 characters and
accepts only letters, numbers, spaces, underscores, hyphens and periods,
falling back to `direct` for anything else. It is written to a hidden input's
`.value` and never rendered as markup. No cookie, no localStorage, no
fingerprinting, no third-party analytics, and the referring page URL is never
read.

`sms_consent` is the A2P 10DLC opt-in for inquiry follow-up texts from
T&R Growth / ServiceMomentum. **Its wording is registered with the A2P campaign
and quoted word for word on `sms-consent.html`; `scripts/validate.mjs` fails if
the form and that quote ever differ.** It is separate from `contact_consent`,
unchecked by default, and the form submits without it. When it is ticked,
js/demo-form.js requires a phone number. An unticked box is submitted as an
explicit `no`, so every submission is a consent record either way. The wording
is also described in `privacy.html` and `terms.html#sms-terms`; change all of
them together, and update the A2P registration first.

**Added automatically at submit time:** `meta_product`, `meta_source`,
`meta_page`, `meta_submitted_at`, plus `_replyto` and `_subject` in `formspree`
mode.

**Never transmitted:** `_gotcha` — the spam trap. Its value is stripped from the
payload, and a filled trap stops the submission silently.

## Accessibility

Every control has a visible label. On a failed check the first problem field
gets focus and the message appears in a `role="alert"` region; sending status
uses `role="status"`. After a real 2xx response the confirmation heading gets
focus. The form posts (never GETs, so nothing lands in a URL) and a
`<noscript>` note tells visitors without JavaScript to email instead.

## What this form does NOT do

- It does **not** send SMS or email on submit (no automated messaging).
- It does **not** set cookies or run analytics.
- It records the optional `sms_consent` choice, and nothing more: ticking the
  box triggers no text. Any follow-up text is sent separately, and only to a
  number whose submission says `sms_consent: yes`.
- It does **not** enroll anyone in the operational SMS lead-alert program (that
  is a separate, opt-in program — see `sms-consent.html`).
