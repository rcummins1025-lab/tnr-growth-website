# Contact / intake form integration

The **Growth System Audit** (`contact.html`) is an eight-screen guided wizard —
one question per screen — for prospective founding clients. It is progressively enhanced JavaScript
(`js/intake.js`), self-contained, with **no third-party libraries, no analytics,
and no tracking**.

## How submission works

The form **only** submits to `window.TNR_CONFIG.formEndpoint` (set in
`js/site-config.js`). Behavior:

| `formEndpoint` | What happens on submit |
| --- | --- |
| `"https://…"` (**current**) | The form POSTs the answers (encoded per `formEndpointMode`) and shows the **real** success or error returned by the endpoint. |
| `""` (empty) | The form validates every step, then shows an **honest “not connected yet”** message and points the visitor to email. **Nothing is transmitted. Success is never faked.** This is the fallback behaviour, not the current state. |
### `formEndpointMode`

`formEndpointMode` selects how the body is encoded. It is **implemented** in
`js/intake.js`; an unrecognized value falls back to `"json"` and logs a console
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

The qualifying answers, plus three metadata fields. Note the naming: metadata
keys deliberately **do not** start with an underscore, because form services
reserve `_`-prefixed names (`_replyto`, `_subject`, `_cc`, `_next`, `_gotcha`,
`_format`) and quietly swallow or repurpose anything else that looks like one.

| Field | Value |
| --- | --- |
| `meta_product` | The current working product name. |
| `meta_source` | Derived slug, e.g. `servicemomentum-audit-form` — survives a rename. |
| `meta_submitted_at` | ISO timestamp. |
| `_replyto` | **formspree mode only** — the applicant's email, so replies go to them. |
| `_subject` | **formspree mode only** — e.g. `ServiceMomentum — Growth System Audit: Acme Heating`. |

### Safeguards on the submission path

These are in `js/intake.js` and are covered by `scripts/validate.mjs`:

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
  the application was **not** submitted.
- **Real error messages.** On a 4xx the provider's own
  `{"errors":[{"message"}]}` body is surfaced to the visitor rather than a
  blanket failure. Both buttons re-enable so they can retry.

## Testing the path without wiring anything

`scripts/mock-endpoint.mjs` is a dependency-free local stand-in. It exists so the
real submission path can be exercised end-to-end **without creating a Formspree
account, wiring a live endpoint, or sending anyone's data anywhere.** It stores
nothing, and it is **never referenced or executed by the production website** —
no page links to it, and `scripts/validate.mjs` fails if one ever does.

> **It is still publicly readable.** This repo is served as static files by
> GitHub Pages, so every committed file is fetchable at its path — including
> `https://tnrgrowthagency.com/scripts/mock-endpoint.mjs`. Pages runs no
> server-side code, so the script cannot *run* there; but *not executed* is not
> *not published*. Treat every file in this repo as public, and keep secrets —
> API keys, tokens, real endpoint URLs, account identifiers, credentials — out
> of all of them. The Formspree endpoint URL itself is not a secret (it ships in
> `js/site-config.js` and is visible in browser dev tools by design); the
> Formspree **account login** is, and never belongs in the repo.

```bash
npm run mock          # serves http://localhost:8125/f/test
```

Then set `formEndpoint` to `http://localhost:8125/f/test`, submit the form, and
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

The audit is an **eight-screen guided wizard** — seven qualification questions,
then one contact screen. This list must match `contact.html` exactly;
`scripts/validate.mjs` fails if the two drift.

**Screens 1–7 — one question each, answered with selection tiles (radio groups):**

| # | Field | Question |
| --- | --- | --- |
| 1 | `industry` | What type of service business do you operate? |
| 2 | `team_size` | How large is your current team? |
| 3 | `past_customers` | About how many past customers do you have? |
| 4 | `customer_database` | Where is customer information kept today? |
| 5 | `post_job_followup` | What happens after a job is completed? |
| 6 | `biggest_opportunity` | Where do you think the biggest opportunity is being lost? |
| 7 | `website_status` | How is your current website performing? |

**Screen 8 — contact details, collected last:**

| Field | Required |
| --- | --- |
| `business_name` | yes |
| `name` (contact name) | yes |
| `email` | yes |
| `phone` | **optional** |
| `service_area` | yes |
| `notes` (free text) | optional |
| `contact_consent` | yes — "Consent is not a condition of any purchase." |

**Added automatically at submit time:** `meta_product`, `meta_source`,
`meta_submitted_at`, plus `_replyto` and `_subject` in `formspree` mode.

**Never transmitted:** `_gotcha` — the spam trap. Its value is stripped from the
payload, and a filled trap stops the submission silently.

## Accessibility

Labels are associated with every control; the step heading receives focus **when
the visitor presses Continue or Back**, but *not* on initial page load (nothing
steals focus from the page heading when the page opens); errors use
`role="alert"`/`aria-live`; the status region uses `role="status"`. A
`<noscript>` block tells non-JS visitors to email instead.

## What this form does NOT do

- It does **not** send SMS or email on submit (no automated messaging).
- It does **not** set cookies or run analytics.
- It does **not** enroll anyone in the operational SMS lead-alert program (that
  is a separate, opt-in program — see `sms-consent.html`).
