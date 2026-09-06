#!/usr/bin/env node
/**
 * validate.mjs — focused checks for this static site (product name lives in
 *   brand.config.json; nothing here hard-codes it).
 * No dependencies. Run: npm run validate  (or: node scripts/validate.mjs)
 *
 * Verifies structure, internal links + anchors, escaping, email consistency,
 * JSON-LD validity, absence of fake rating markup, the Gavin-pilot claim
 * guardrails, the brand symbol (present, drawn not embedded, approved colours,
 * no letterforms), the form's submission safeguards, and the motion layer's
 * reduced-motion / fail-open guarantees.
 * Exits non-zero if anything fails.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  slugFor,
  MARK_COLORS,
  FORGE_PALETTE,
  RETIRED_COLORS,
  APPROVED_MARK_PAINTS,
  MARK_ASSETS,
  INITIALS_BADGE_RE
} from "./brand-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = readdirSync(root).filter((f) => f.endsWith(".html"));
let fails = 0;
let checks = 0;
const fail = (m) => {
  fails++;
  console.log("  ✗ " + m);
};
const ok = (m) => {
  checks++;
  console.log("  ✓ " + m);
};

const read = (f) => readFileSync(join(root, f), "utf8");

// Collect id="" anchors per page (for fragment link checks).
const idsByPage = {};
for (const f of htmlFiles) {
  const html = read(f);
  const ids = new Set();
  for (const m of html.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  idsByPage[f] = ids;
}

console.log("\n== Structure ==");
for (const f of htmlFiles) {
  const h = read(f);
  const titles = (h.match(/<title>/g) || []).length;
  titles === 1 ? ok(`${f}: one <title>`) : fail(`${f}: ${titles} <title> tags`);
  /<html lang="en">/.test(h) ? ok(`${f}: lang=en`) : fail(`${f}: missing lang`);
  /rel="canonical"/.test(h)
    ? ok(`${f}: canonical`)
    : fail(`${f}: missing canonical`);
  /name="viewport"/.test(h)
    ? ok(`${f}: viewport`)
    : fail(`${f}: missing viewport`);
}

console.log("\n== Escaping (raw & outside entities) ==");
for (const f of htmlFiles) {
  const h = read(f);
  const bad = [...h.matchAll(/&(?!amp;|lt;|gt;|quot;|#\d+;|[a-z]+;)/g)];
  bad.length === 0
    ? ok(`${f}: clean`)
    : fail(`${f}: ${bad.length} raw ampersand(s)`);
}

console.log("\n== Email consistency ==");
for (const f of htmlFiles.concat(["js/site-config.js", "brand.config.json"])) {
  if (!existsSync(join(root, f))) continue;
  const h = read(f);
  if (/ryan@tnrgrowthagency\.com/.test(h)) fail(`${f}: contains old ryan@ email`);
  const emails = [...h.matchAll(/[A-Za-z0-9._%+-]+@tnrgrowthagency\.com/g)].map(
    (m) => m[0]
  );
  const bad = emails.filter((e) => e !== "hello@tnrgrowthagency.com");
  bad.length === 0
    ? ok(`${f}: emails ok (${emails.length})`)
    : fail(`${f}: unexpected email(s): ${[...new Set(bad)].join(", ")}`);
}

console.log("\n== Internal links + anchors ==");
for (const f of htmlFiles) {
  const h = read(f);
  const refs = [...h.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|#|mailto:|tel:|data:)/.test(ref)) {
      if (ref.startsWith("#")) {
        const id = ref.slice(1);
        if (id && !idsByPage[f].has(id)) fail(`${f}: dead anchor ${ref}`);
      }
      continue;
    }
    const [path, frag] = ref.split("#");
    if (path && !existsSync(join(root, path)))
      fail(`${f}: missing file ${path}`);
    else if (frag && path.endsWith(".html") && idsByPage[path] && !idsByPage[path].has(frag))
      fail(`${f}: ${ref} -> #${frag} not found in ${path}`);
  }
  ok(`${f}: link refs checked (${refs.length})`);
}

console.log("\n== JSON-LD validity ==");
for (const f of htmlFiles) {
  const h = read(f);
  const blocks = [
    ...h.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    )
  ];
  for (const b of blocks) {
    try {
      JSON.parse(b[1].trim());
      ok(`${f}: JSON-LD parses`);
    } catch (e) {
      fail(`${f}: JSON-LD invalid (${e.message})`);
    }
  }
}

console.log("\n== No fake rating / review markup ==");
for (const f of htmlFiles) {
  const h = read(f);
  const bad = /aggregateRating|reviewRating|ratingValue|reviewCount/i.test(h);
  bad ? fail(`${f}: contains rating markup`) : ok(`${f}: no rating markup`);
}

console.log("\n== Gavin-pilot claim guardrails ==");
const banned = [
  "cannabis",
  "we guarantee",
  "guaranteed placement",
  "guaranteed leads",
  "guaranteed growth",
  "guaranteed results",
  "guaranteed revenue",
  "rank first",
  "ranks first",
  "always ranks",
  "always first",
  "in revenue",
  "generated $",
  "scaled gavin"
];
for (const f of htmlFiles) {
  const h = read(f).toLowerCase();
  const hit = banned.filter((p) => h.includes(p));
  hit.length === 0
    ? ok(`${f}: no banned claims`)
    : fail(`${f}: banned phrase(s): ${hit.join(", ")}`);
}

console.log("\n== Positioning + SEO assets ==");
const idx = read("index.html");
idx.includes(
  "Turn your website and past customers into a repeatable growth system"
)
  ? ok("index: positioning statement present")
  : fail("index: positioning statement missing");
existsSync(join(root, "robots.txt"))
  ? ok("robots.txt present")
  : fail("robots.txt missing");
if (existsSync(join(root, "sitemap.xml"))) {
  const sm = read("sitemap.xml");
  /<urlset/.test(sm) && /tnrgrowthagency\.com\/</.test(sm)
    ? ok("sitemap.xml valid + has canonical URLs")
    : fail("sitemap.xml malformed");
} else fail("sitemap.xml missing");
existsSync(join(root, "assets/og-image.svg"))
  ? ok("og-image present")
  : fail("og-image missing");
existsSync(join(root, "CNAME")) && read("CNAME").trim() === "tnrgrowthagency.com"
  ? ok("CNAME preserved (tnrgrowthagency.com)")
  : fail("CNAME changed or missing");


console.log("\n== Brand symbol: drawn geometry, approved colours, no letters ==");
const brand = JSON.parse(read("brand.config.json"));
const mark = brand.productMark || {};
/PROVISIONAL/.test(mark.status || "")
  ? ok("brand.config: symbol is recorded as PROVISIONAL pending name/trademark clearance")
  : fail("brand.config: productMark.status must record the symbol as PROVISIONAL");
mark.forgeBlack === MARK_COLORS.forgeBlack &&
mark.burntOrange === MARK_COLORS.burntOrange
  ? ok(`brand.config: mark colours are Forge Black ${MARK_COLORS.forgeBlack} + Burnt Orange ${MARK_COLORS.burntOrange}`)
  : fail("brand.config: productMark colours do not match the approved palette");

for (const f of MARK_ASSETS) {
  if (!existsSync(join(root, f))) {
    fail(`${f}: missing brand symbol asset`);
    continue;
  }
  const svg = read(f);
  ok(`${f}: present`);

  // Drawn, not traced or embedded: no raster of any kind, however referenced.
  const raster = [
    [/<image\b/i, "<image> element"],
    [/base64/i, "base64 payload"],
    [/data:image/i, "data:image URI"],
    [/\.(png|jpe?g|gif|webp|avif|bmp|tiff?)\b/i, "raster file reference"],
    [/xlink:href|(?<!\w)href=/i, "external href"],
    [/<foreignObject/i, "<foreignObject>"]
  ].filter(([re]) => re.test(svg));
  raster.length === 0
    ? ok(`${f}: no embedded or referenced raster art`)
    : fail(`${f}: contains ${raster.map(([, n]) => n).join(", ")}`);

  // Only the approved paints.
  const paints = [...svg.matchAll(/(?:fill|stroke|stop-color|flood-color)="([^"]*)"/g)].map(
    (m) => m[1].trim().toLowerCase()
  );
  const rogue = [...new Set(paints.filter((c) => !APPROVED_MARK_PAINTS.has(c)))];
  rogue.length === 0
    ? ok(`${f}: ${paints.length} paint value(s), all approved`)
    : fail(`${f}: unapproved colour(s): ${rogue.join(", ")}`);

  // The primary + reversed variants must carry exactly one amber accent node.
  if (f !== "assets/mark-mono.svg") {
    const endpoint = (svg.match(new RegExp(MARK_COLORS.burntOrange, "gi")) || []).length;
    endpoint === 1
      ? ok(`${f}: exactly one Burnt Orange endpoint`)
      : fail(`${f}: ${endpoint} Burnt Orange uses (expected exactly 1)`);
  }

  // Banned decoration and motifs.
  const banned = [
    [/<(linear|radial)Gradient|gradient/i, "gradient"],
    [/<filter|feGaussianBlur|feDropShadow|drop-shadow|box-shadow/i, "filter/shadow/glow"],
    [/marker-end|arrow/i, "arrow"]
  ].filter(([re]) => re.test(svg));
  banned.length === 0
    ? ok(`${f}: no gradients, shadows, glow or arrows`)
    : fail(`${f}: contains ${banned.map(([, n]) => n).join(", ")}`);

  // No letterforms, and no product wordmark baked into the artwork.
  /<text\b/i.test(svg)
    ? fail(`${f}: contains <text> — the symbol must not depend on letters`)
    : ok(`${f}: letter-free (no <text>)`);
  new RegExp(brand.productName, "i").test(svg)
    ? fail(`${f}: the product name is baked into the artwork`)
    : ok(`${f}: no product name baked in`);
  /PROVISIONAL/.test(svg)
    ? ok(`${f}: labelled PROVISIONAL`)
    : fail(`${f}: must be labelled PROVISIONAL until the name clears`);
}

console.log("\n== Lockup: symbol in markup, product name as HTML text ==");
for (const f of htmlFiles) {
  const h = read(f);
  const marks = (h.match(/class="brand-mark"/g) || []).length;
  marks >= 1
    ? ok(`${f}: ${marks} brand symbol reference(s)`)
    : fail(`${f}: no brand symbol in the lockup`);
  const stale = [...h.matchAll(INITIALS_BADGE_RE)];
  stale.length === 0
    ? ok(`${f}: no letter-initials badge`)
    : fail(`${f}: the retired initials badge is back (${stale.length} occurrence(s))`);
  const names = (h.match(/data-brand="product"/g) || []).length;
  names >= 1
    ? ok(`${f}: product name is HTML text (data-brand="product")`)
    : fail(`${f}: product name must stay centralized HTML text`);
  // The symbol must reserve its space so it cannot shift the layout.
  const imgs = [...h.matchAll(/<img[^>]*class="brand-mark"[^>]*>/g)].map((m) => m[0]);
  imgs.every((t) => /width="\d+"/.test(t) && /height="\d+"/.test(t))
    ? ok(`${f}: symbol has intrinsic width/height (no layout shift)`)
    : fail(`${f}: brand-mark <img> missing width/height`);
}
/href="favicon\.svg"/.test(read("index.html"))
  ? ok("index: favicon points at the updated mark")
  : fail("index: favicon link missing");

// Every shipped file: no leftover form of a previous working name, in any casing.
const brandSlug = slugFor(brand.productName);
console.log("\n== Form: safeguards, endpoint mode, focus behavior ==");
const cfgJs = read("js/site-config.js");
const intake = read("js/intake.js");
const endpoint = (cfgJs.match(/formEndpoint:\s*"([^"]*)"/) || [])[1];
endpoint === "" || /^https:\/\//.test(endpoint)
  ? ok(`site-config: formEndpoint ${endpoint === "" ? "unset (form never fakes success)" : "is https"}`)
  : fail(`site-config: formEndpoint must be "" or an https URL (got ${JSON.stringify(endpoint)})`);
const mode = (cfgJs.match(/formEndpointMode:\s*"([^"]*)"/) || [])[1];
["json", "formspree"].includes(mode)
  ? ok(`site-config: formEndpointMode "${mode}" is a supported mode`)
  : fail(`site-config: formEndpointMode must be "json" or "formspree" (got ${JSON.stringify(mode)})`);
/formEndpointMode/.test(intake) && /mode === "formspree"/.test(intake)
  ? ok("intake: formEndpointMode is actually implemented (json + formspree bodies)")
  : fail("intake: formEndpointMode is documented but not used");
/showStep\(0, false\)/.test(intake)
  ? ok("intake: step 1 heading is NOT focused on initial load")
  : fail("intake: initial render must not move focus (expected showStep(0, false))");
/showStep\(current \+ 1, true\)/.test(intake) && /showStep\(current - 1, true\)/.test(intake)
  ? ok("intake: focus still moves after Continue and Back")
  : fail("intake: Continue/Back must move focus to the step heading");
/not connected to a submission service yet/.test(intake)
  ? ok("intake: honest not-connected message preserved")
  : fail("intake: not-connected message missing (success must never be faked)");

console.log("\n== Submission path: ready for a real form endpoint ==");
// Metadata must not squat on the "_"-prefixed keys form services reserve.
/data\._product\b|data\._source\b|data\._submittedAt\b/.test(intake)
  ? fail('intake: metadata still uses reserved "_"-prefixed keys (use meta_*)')
  : ok("intake: metadata uses non-reserved meta_* keys");
/meta_product/.test(intake) && /meta_source/.test(intake) && /meta_submitted_at/.test(intake)
  ? ok("intake: submission carries product, source and timestamp metadata")
  : fail("intake: submission metadata missing");
/_replyto/.test(intake) && /_subject/.test(intake)
  ? ok("intake: formspree mode sets _replyto and _subject")
  : fail("intake: formspree mode must set _replyto and _subject");

// Spam trap: present in the markup, out of view and out of the tab order, and
// never transmitted.
const contactHtml = read("contact.html");
const stylesCss = read("styles.css");
const hp = /<input[^>]*name="_gotcha"[^>]*>/.exec(contactHtml);
hp ? ok("contact: spam trap present") : fail("contact: spam trap (_gotcha) missing");
if (hp) {
  /tabindex="-1"/.test(hp[0])
    ? ok("contact: spam trap is out of the tab order")
    : fail("contact: spam trap must have tabindex=-1");
  /class="hp"/.test(contactHtml) && /\.hp\s*\{[^}]*left:\s*-9999px/.test(stylesCss)
    ? ok("contact: spam trap is positioned off-screen (no layout effect)")
    : fail("contact: spam trap must be hidden off-screen via .hp");
}
/if \(k === HONEYPOT\) return;/.test(intake)
  ? ok("intake: spam-trap value is never transmitted")
  : fail("intake: spam-trap value must be stripped from the payload");
/if \(trap && trap\.value\) return;/.test(intake)
  ? ok("intake: a filled spam trap stops the submission silently")
  : fail("intake: a filled spam trap must stop the submission");

// Endpoint safety, timeout, and real error surfacing.
/function endpointIsSafe/.test(intake)
  ? ok("intake: endpoint is safety-checked before any request")
  : fail("intake: missing endpoint safety check");
/u\.protocol !== "https:"/.test(intake)
  ? ok("intake: refuses non-https endpoints (localhost excepted for the mock)")
  : fail("intake: must refuse non-https endpoints");
/zentradesk\|middleware/.test(intake)
  ? ok("intake: refuses the tenant-scoped client-booking backend")
  : fail("intake: must refuse the client-booking backend");
/REQUEST_TIMEOUT_MS/.test(intake) && /AbortController/.test(intake)
  ? ok("intake: requests time out instead of hanging on 'Sending…'")
  : fail("intake: submission needs a timeout");
/body\.errors/.test(intake)
  ? ok("intake: surfaces the provider's own error messages")
  : fail("intake: must surface provider errors, not a blanket failure");

// The mock endpoint is dev tooling: it must never be referenced by the site.
existsSync(join(root, "scripts/mock-endpoint.mjs"))
  ? ok("scripts/mock-endpoint.mjs present (dev-only test target)")
  : fail("scripts/mock-endpoint.mjs missing");
const mockRefs = htmlFiles.filter((f) => /localhost:8125|mock-endpoint/.test(read(f)));
mockRefs.length === 0
  ? ok("no page references the local mock endpoint")
  : fail(`mock endpoint referenced by: ${mockRefs.join(", ")}`);
/localhost|127\.0\.0\.1/.test(endpoint || "")
  ? fail("site-config: formEndpoint is still pointed at a local mock")
  : ok("site-config: formEndpoint is not a local mock");

console.log("\n== Motion layer: reduced motion, fail-open, no heavy deps ==");
const css = read("styles.css");
/@media \(prefers-reduced-motion: reduce\)/.test(css)
  ? ok("styles: prefers-reduced-motion honored")
  : fail("styles: no prefers-reduced-motion block");
const motionJs = existsSync(join(root, "js/motion.js")) ? read("js/motion.js") : "";
motionJs
  ? ok("js/motion.js present")
  : fail("js/motion.js missing");
/IntersectionObserver/.test(motionJs)
  ? ok("motion: uses IntersectionObserver (no scroll listeners)")
  : fail("motion: expected IntersectionObserver");
/addEventListener\(\s*["']scroll/.test(motionJs)
  ? fail("motion: scroll listener found (no scroll hijacking)")
  : ok("motion: no scroll listeners");
/data-motion-ready/.test(motionJs)
  ? ok("motion: signals readiness so the gate can fail open")
  : fail("motion: must set data-motion-ready");
for (const f of htmlFiles) {
  const h = read(f);
  const usesMotion = /js\/motion\.js/.test(h);
  if (!usesMotion) continue;
  /prefers-reduced-motion: reduce/.test(h) && /classList\.add\("motion"\)/.test(h)
    ? ok(`${f}: motion gate present (reduced motion opts out entirely)`)
    : fail(`${f}: loads motion.js without the reduced-motion gate`);
  /data-motion-ready/.test(h)
    ? ok(`${f}: motion gate fails open if motion.js does not load`)
    : fail(`${f}: motion gate has no fail-open fallback`);
}
for (const f of htmlFiles) {
  const h = read(f);
  const ext = [...h.matchAll(/<script[^>]+src="(https?:)?\/\/[^"]+"/g)];
  ext.length === 0 ? ok(`${f}: no third-party scripts`) : fail(`${f}: external script(s) added`);
  /<video|autoplay/i.test(h) ? fail(`${f}: autoplaying media added`) : ok(`${f}: no autoplay media`);
}

console.log("\n== Guided audit wizard: structure, fields, accessibility ==");
const wiz = read("contact.html");

// The "Selected" word is decoration. If it reaches the accessible name, every
// option is announced as selected — the native radio state must carry it.
const stateSpans = [...wiz.matchAll(/<span class="wz-state"([^>]*)>/g)];
const exposedStates = stateSpans.filter((m) => !/aria-hidden="true"/.test(m[1]));
stateSpans.length > 0 && exposedStates.length === 0
  ? ok(`contact: all ${stateSpans.length} .wz-state labels are aria-hidden`)
  : fail(
      `contact: ${exposedStates.length} of ${stateSpans.length} .wz-state label(s) still reach the accessible name`
    );

// Eight screens: seven qualification questions plus the contact screen.
const screens = [...wiz.matchAll(/<fieldset class="wz-step form-step" data-step="(\d+)"([^>]*)>/g)];
screens.length === 8
  ? ok("contact: exactly 8 wizard screens")
  : fail(`contact: ${screens.length} wizard screens (expected 8)`);
const numbering = screens.map((m) => Number(m[1])).join(",");
numbering === "1,2,3,4,5,6,7,8"
  ? ok("contact: screens are numbered 1-8 in order")
  : fail(`contact: screen numbering is ${numbering}`);

// Only the active step may be exposed; every other screen carries `hidden`.
const exposed = screens.filter((m) => !/\bhidden\b/.test(m[2]));
exposed.length === 1 && Number(exposed[0][1]) === 1
  ? ok("contact: only step 1 is exposed on load; the other 7 are hidden")
  : fail(
      `contact: ${exposed.length} step(s) exposed on load (expected exactly step 1)`
    );
/showStep\(0, false\)/.test(intake) && /s\.hidden = idx !== i/.test(intake)
  ? ok("intake: exactly one step is unhidden at a time")
  : fail("intake: step exposure must hide every step but the current one");

// The agreed field set, exactly.
const QUALIFICATION_FIELDS = [
  "industry",
  "team_size",
  "past_customers",
  "customer_database",
  "post_job_followup",
  "biggest_opportunity",
  "website_status"
];
const CONTACT_FIELDS = [
  "business_name",
  "name",
  "email",
  "phone",
  "service_area",
  "notes",
  "contact_consent"
];
const missingQ = QUALIFICATION_FIELDS.filter(
  (f) => !new RegExp(`data-required-group="${f}"`).test(wiz)
);
missingQ.length === 0
  ? ok(`contact: all ${QUALIFICATION_FIELDS.length} qualification questions present`)
  : fail(`contact: missing qualification field(s): ${missingQ.join(", ")}`);
const missingC = CONTACT_FIELDS.filter(
  (f) => !new RegExp(`name="${f}"`).test(wiz)
);
missingC.length === 0
  ? ok(`contact: all ${CONTACT_FIELDS.length} final contact fields present`)
  : fail(`contact: missing contact field(s): ${missingC.join(", ")}`);
/name="phone"[^>]*required/.test(wiz)
  ? fail("contact: phone must stay optional")
  : ok("contact: phone is optional");
/name="contact_consent"[^>]*required/.test(wiz)
  ? ok("contact: consent checkbox is present and required")
  : fail("contact: consent checkbox must remain required");

// The live endpoint is approved and verified — it must not drift.
const APPROVED_ENDPOINT = "https://formspree.io/f/xqpklkny";
endpoint === APPROVED_ENDPOINT
  ? ok(`site-config: live Formspree endpoint unchanged (${APPROVED_ENDPOINT})`)
  : fail(
      `site-config: formEndpoint is ${JSON.stringify(endpoint)}, expected ${APPROVED_ENDPOINT}`
    );
mode === "formspree"
  ? ok('site-config: formEndpointMode is still "formspree"')
  : fail(`site-config: formEndpointMode drifted to ${JSON.stringify(mode)}`);

console.log("\n== Forge palette: centralized, and the old identity cannot return ==");
const cssText = read("styles.css");

// The six approved colours must all be declared as --forge-* tokens.
const missingPalette = Object.entries(FORGE_PALETTE).filter(
  ([, hex]) => !new RegExp(hex.replace("#", "#") + "\\b", "i").test(cssText)
);
missingPalette.length === 0
  ? ok(`styles: all ${Object.keys(FORGE_PALETTE).length} Forge palette colours declared`)
  : fail(`styles: palette colours missing from styles.css: ${missingPalette.map(([n]) => n).join(", ")}`);

// Every colour must live in the palette block at the top — nothing below it may
// hard-code a hex, or the palette stops being changeable in one place.
const paletteBlockEnd = cssText.indexOf("\n}", cssText.indexOf(":root {"));
const belowPalette = cssText.slice(paletteBlockEnd);
const strayHex = [...new Set((belowPalette.match(/#[0-9a-fA-F]{3,8}\b/g) || []))];
strayHex.length === 0
  ? ok("styles: no hard-coded hex below the palette block — every colour is a token")
  : fail(`styles: ${strayHex.length} hard-coded colour(s) outside the palette block: ${strayHex.slice(0, 6).join(", ")}`);

// The retired navy/gold identity must not reappear anywhere that ships.
const shippedForColor = [
  ...htmlFiles,
  "styles.css",
  "brand.config.json",
  ...MARK_ASSETS,
  "assets/og-image.svg",
  ...readdirSync(join(root, "assets"))
    .filter((f) => f.endsWith(".svg"))
    .map((f) => "assets/" + f)
].filter((f, i, a) => a.indexOf(f) === i && existsSync(join(root, f)));
let retiredHits = 0;
for (const f of shippedForColor) {
  const body = read(f);
  const hits = RETIRED_COLORS.filter((c) => new RegExp(c + "\\b", "i").test(body));
  if (hits.length) {
    retiredHits += hits.length;
    fail(`${f}: retired navy/gold colour(s) returned: ${hits.join(", ")}`);
  }
}
retiredHits === 0
  ? ok(`no retired navy/gold colour in any of ${shippedForColor.length} shipped files`)
  : fail(`${retiredHits} retired colour reference(s) still shipping`);

// The logo must read as Forge: charcoal (or white) pathway, orange endpoint.
for (const f of ["assets/mark.svg", "assets/mark-reversed.svg"]) {
  const svg = read(f);
  const pathway = f.includes("reversed") ? "#FFFFFF" : MARK_COLORS.forgeBlack;
  new RegExp(`stroke="${pathway}"`, "i").test(svg)
    ? ok(`${f}: pathway is ${pathway}`)
    : fail(`${f}: pathway is not ${pathway}`);
  new RegExp(`r="[\\d.]+" fill="${MARK_COLORS.burntOrange}"`, "i").test(svg)
    ? ok(`${f}: endpoint is Burnt Orange`)
    : fail(`${f}: endpoint is not Burnt Orange`);
}

console.log("\n== Contrast: the palette has to stay legible ==");
const hexOf = (name) => {
  const m = cssText.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  return m ? m[1] : null;
};
const relLum = (hex) => {
  const h = hex.replace("#", "");
  const ch = (i) => {
    const c =
      parseInt(h.length === 3 ? h[i] + h[i] : h.substr(i * 2, 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
};
const contrast = (a, b) => {
  const l1 = relLum(a);
  const l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const PAIRS = [
  ["body text on white", "forge-black", "forge-white", 4.5],
  ["body text on Warm Canvas", "forge-black", "forge-canvas", 4.5],
  ["secondary text on white", "forge-ink-2", "forge-white", 4.5],
  ["muted text on Warm Canvas", "forge-steel-text", "forge-canvas", 4.5],
  ["orange text on Warm Canvas", "forge-orange-text", "forge-canvas", 4.5],
  ["text on Forge Black", "forge-on-dark", "forge-black", 4.5],
  ["muted text on Forge Black", "forge-on-dark-muted", "forge-black", 4.5],
  // Burnt Orange is only 3.6:1 on white, so the primary button uses Forge Black
  // text on the orange fill. This is the check that keeps it that way.
  ["primary button text on Burnt Orange", "forge-black", "forge-orange", 4.5],
  ["Burnt Orange as a UI colour on white", "forge-orange", "forge-white", 3],
  ["focus ring on white", "focus", "forge-white", 3],
  ["focus ring on Warm Canvas", "focus", "forge-canvas", 3]
];
for (const [label, fg, bg, min] of PAIRS) {
  const a = hexOf(fg);
  const b = hexOf(bg);
  if (!a || !b) {
    fail(`contrast: token --${!a ? fg : bg} not found`);
    continue;
  }
  const ratio = contrast(a, b);
  ratio >= min
    ? ok(`contrast: ${label} = ${ratio.toFixed(2)}:1 (needs ${min})`)
    : fail(`contrast: ${label} = ${ratio.toFixed(2)}:1, below ${min}`);
}
// The primary button must not put white on Burnt Orange.
const btnGold = (cssText.match(/\.btn-gold\s*\{[^}]*\}/) || [""])[0];
/background:\s*var\(--gold\)/.test(btnGold) &&
/color:\s*var\(--forge-black\)/.test(btnGold)
  ? ok("styles: primary button is Forge Black on Burnt Orange")
  : fail("styles: .btn-gold must be Forge Black text on the Burnt Orange fill");

console.log("\n== Endpoint truth: one source, and the docs must match it ==");
// One endpoint source. brand.config.json must NOT mirror it — the two drifted
// once (site-config live, brand.config empty) and would drift again.
const brandRaw = read("brand.config.json");
const brandJson = JSON.parse(brandRaw);
// Prohibited: anything that looks like a second endpoint source. Allowed:
// endpointConfigNote, which is documentation only and deliberately named off
// the endpoint namespace so it cannot be mistaken for configuration.
const FORBIDDEN_BRAND_KEYS = [
  "formEndpoint",
  "formEndpointMode",
  "formEndpointNote"
];
const reintroduced = FORBIDDEN_BRAND_KEYS.filter((k) => k in brandJson);
reintroduced.length === 0
  ? ok(
      "brand.config.json: no mirrored endpoint key (single source of truth is js/site-config.js)"
    )
  : fail(
      `brand.config.json: prohibited endpoint key(s) returned: ${reintroduced.join(", ")}`
    );
typeof brandJson.endpointConfigNote === "string" &&
/site-config/.test(brandJson.endpointConfigNote)
  ? ok("brand.config.json: endpointConfigNote explains where the endpoint lives")
  : fail(
      "brand.config.json: endpointConfigNote missing or no longer points at js/site-config.js"
    );
if ("formEndpoint" in brandJson && brandJson.formEndpoint !== endpoint)
  fail(
    `brand.config/site-config endpoint disagreement: ${JSON.stringify(brandJson.formEndpoint)} vs ${JSON.stringify(endpoint)}`
  );

// Documentation may not claim the endpoint is empty while a live one is wired.
const DOC_FILES = ["README.md", "docs/CONTACT-FORM.md", "docs/LAUNCH-CHECKLIST.md"];
const EMPTY_CLAIMS = [
  /endpoint is \*\*empty/i,
  /empty by default/i,
  /`formEndpoint` is empty (today|by default)/i,
  /is empty, so the form (does not|doesn't) transmit/i,
  /not yet launch-ready/i,
  /needs a real endpoint/i,
  /no external account has been\s+created/i,
  /set `formEndpoint` back to `""`/i
];
let staleDocs = 0;
for (const f of DOC_FILES) {
  if (!existsSync(join(root, f))) continue;
  const body = read(f);
  const hits = EMPTY_CLAIMS.filter((re) => re.test(body));
  if (hits.length) {
    staleDocs += hits.length;
    fail(`${f}: still claims the endpoint is empty / unwired (${hits.length} statement(s))`);
  }
}
staleDocs === 0
  ? ok(`docs: no stale "endpoint is empty" claims across ${DOC_FILES.length} files`)
  : fail(`${staleDocs} stale endpoint claim(s) in documentation`);

// A mock test must be told to restore the REAL endpoint, never "".
const mockDoc = read("scripts/mock-endpoint.mjs") + read("docs/CONTACT-FORM.md");
/RESTORE THE REAL ENDPOINT/i.test(mockDoc) ||
/restore the \*\*real endpoint\*\*/i.test(mockDoc)
  ? ok("mock: instructions restore the real endpoint, not an empty string")
  : fail('mock: instructions must say to restore the real endpoint, not ""');

// Current logo/brand documentation must not use retired palette names outside a
// clearly labelled Retired/history line.
console.log("\n== Brand terminology: retired names only in Retired sections ==");
const RETIRED_NAMES = /Service Navy|Momentum Amber/g;
const TERM_FILES = [
  "README.md", "docs/BRAND.md", "brand.config.json",
  ...MARK_ASSETS, "assets/og-image.svg"
].filter((f) => existsSync(join(root, f)));
let staleTerms = 0;
for (const f of TERM_FILES) {
  const lines = read(f).split("\n");
  const bad = lines.filter(
    (l) => RETIRED_NAMES.test(l) && !/retired/i.test(l) && !/history/i.test(l)
  );
  RETIRED_NAMES.lastIndex = 0;
  if (bad.length) {
    staleTerms += bad.length;
    fail(`${f}: retired palette name outside a Retired/history line: "${bad[0].trim().slice(0, 60)}"`);
  }
}
staleTerms === 0
  ? ok(`brand terms: no retired palette names in current descriptions (${TERM_FILES.length} files)`)
  : fail(`${staleTerms} retired palette name(s) in current descriptions`);

// The documented field list must match the wizard's actual fields.
console.log("\n== Documented wizard fields match the wizard ==");
const contactDoc = read("docs/CONTACT-FORM.md");
const actualQ = [...wiz.matchAll(/data-required-group="([a-z_]+)"/g)].map((m) => m[1]);
const actualContact = [...wiz.matchAll(/<(?:input|textarea)[^>]*\bname="([a-z_]+)"/g)]
  .map((m) => m[1])
  .filter((n) => !actualQ.includes(n) && n !== "_gotcha");
const documented = [...contactDoc.matchAll(/\| `([a-z_]+)`/g)].map((m) => m[1]);
const undocumented = [...new Set([...actualQ, ...actualContact])].filter(
  (f) => !documented.includes(f)
);
const overdocumented = [...new Set(documented)].filter(
  (f) =>
    !actualQ.includes(f) &&
    !actualContact.includes(f) &&
    !["meta_product", "meta_source", "meta_submitted_at", "_replyto", "_subject"].includes(f)
);
undocumented.length === 0
  ? ok(`docs: all ${actualQ.length + actualContact.length} wizard fields are documented`)
  : fail(`docs/CONTACT-FORM.md: undocumented wizard field(s): ${undocumented.join(", ")}`);
overdocumented.length === 0
  ? ok("docs: no documented field that the wizard no longer collects")
  : fail(`docs/CONTACT-FORM.md: documents retired field(s): ${overdocumented.join(", ")}`);

console.log("\n== Prospect tracker: real rows only (private workspace) ==");
// The tracker lives OUTSIDE this repository on purpose — it holds personal
// information and this repo is published by GitHub Pages. This check is
// therefore optional: it runs when the sibling workspace exists and skips
// cleanly when it does not. It reads counts and flags only, never contents.
const TRACKER = join(root, "..", "ServiceMomentumBusiness", "sales", "prospect-tracker.csv");
if (!existsSync(TRACKER)) {
  ok("tracker: private workspace not present here — check skipped");
} else {
  const lines = readFileSync(TRACKER, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  const header = (lines[0] || "").split(",");
  header.length === 18 && header[0] === "business_name"
    ? ok(`tracker: header intact (${header.length} columns)`)
    : fail(`tracker: header changed (${header.length} columns)`);
  const FAKE = /example|delete this row|jane doe|john doe|acme|test prospect|lorem|555-01\d\d|@example\.(com|org)|foo\b|placeholder/i;
  const fakeRows = lines.slice(1).filter((l) => FAKE.test(l));
  fakeRows.length === 0
    ? ok(`tracker: ${lines.length - 1} data row(s), none example/fake`)
    : fail(
        `tracker: ${fakeRows.length} example/fake row(s) present — remove them; TRACKER-FIELD-GUIDE.md documents the columns`
      );
  // The tracker must never be copied into this published repository.
  existsSync(join(root, "sales")) || existsSync(join(root, "prospect-tracker.csv"))
    ? fail("tracker: prospect data has been copied into the PUBLISHED website repo")
    : ok("tracker: no prospect data inside the published repo");
}

console.log("\n== Reviewed copy corrections ==");
const contact = read("contact.html");
!/send your audit summary/i.test(contact)
  ? ok("contact: no audit-summary promise")
  : fail("contact: still promises an audit summary");
/So we can review your answers and follow up\./.test(contact)
  ? ok("contact: corrected step-5 hint present")
  : fail("contact: corrected step-5 hint missing");
const idxHtml = read("index.html");
/A working implementation connecting discovery, lead handling,\s*\n?\s*completed service, and follow-up\./.test(idxHtml)
  ? ok("index: corrected case-study introduction present")
  : fail("index: corrected case-study introduction missing");
!/operated, in order/.test(idxHtml)
  ? ok('index: "in order" removed from the case study')
  : fail('index: case study still says "in order"');
// Every drawn interface composition must carry a visible "not live data" label.
const compositions =
  (idxHtml.match(/class="stack"/g) || []).length +
  (idxHtml.match(/class="pillar-visual"/g) || []).length;
const illusLabels = [...idxHtml.matchAll(/not live data/gi)].length;
compositions > 0 && illusLabels >= compositions
  ? ok(`index: ${illusLabels} "not live data" label(s) for ${compositions} drawn interface composition(s)`)
  : fail(
      `index: ${compositions} drawn interface composition(s) but only ${illusLabels} "not live data" label(s)`
    );
/Illustrative/i.test(idxHtml)
  ? ok("index: interface visuals are called illustrative")
  : fail("index: interface visuals must be labelled illustrative");
// No invented statistics, ratings, or revenue anywhere in the marketing copy.
const invented = [
  [/\b\d+(\.\d+)?\s*%/g, "a percentage figure"],
  [/\b\d+(\.\d+)?\s*(x|×)\s*(more|faster|growth|leads|revenue)/gi, "a multiplier claim"],
  [/\b\d+(\.\d+)?\s*(star|stars)\b/gi, "a star rating"],
  [/\$\s?\d/g, "a dollar figure"],
  [/\b\d[\d,]*\s+(reviews|customers served|jobs booked|leads generated)\b/gi, "a fabricated count"]
].filter(([re]) => re.test(idxHtml));
invented.length === 0
  ? ok("index: no invented statistics, ratings, or revenue figures")
  : fail(`index: contains ${invented.map(([, n]) => n).join(", ")}`);
/prepared by the system and sent manually|sent <strong>manually<\/strong>/.test(idxHtml)
  ? ok("index: manual-message disclosure preserved")
  : fail("index: manual-message disclosure missing");

console.log("\n== Audit success screen: structure and copy ==");
// The two-column confirmation that replaces the question stage after a real
// submission. Every check here guards one promise: it appears only when the
// endpoint actually accepted the application, it claims nothing more than we
// agreed to, and nothing a visitor typed can reach the page as markup.
const successHtml = (contact.match(
  /<section\s+id="audit-success"[\s\S]*?<\/section>/
) || [""])[0];
successHtml
  ? ok("contact: success panel markup present")
  : fail("contact: success panel (#audit-success) is missing");

/<section\s+id="audit-success"[^>]*\shidden(\s|>)/.test(contact)
  ? ok("contact: success panel ships hidden")
  : fail("contact: success panel must carry `hidden` in the markup");

// Two panes plus the joining rule: the composition the design calls for.
["wz-done-main", "wz-done-aside"].every((c) =>
  new RegExp(`class="${c}"`).test(successHtml)
)
  ? ok("contact: success panel has both panes")
  : fail("contact: success panel must have a left and a right pane");

// Status semantics, but silenced: focus moves to the heading instead, so a
// polite region here would read the panel out and then repeat the heading.
/role="status"/.test(successHtml)
  ? ok("contact: success panel carries status semantics")
  : fail('contact: success panel needs role="status"');
/aria-live="off"/.test(successHtml)
  ? ok("contact: success panel will not double-announce over the focus move")
  : fail('contact: success panel needs aria-live="off" alongside role="status"');
/aria-labelledby="audit-success-title"/.test(successHtml)
  ? ok("contact: success panel is labelled by its heading")
  : fail("contact: success panel needs aria-labelledby on its heading");

// The approved copy, exactly. The heading and the supporting line ship as the
// no-name / no-business fallbacks; js/intake.js rewrites them when it can.
const SUCCESS_COPY = [
  ["Audit received", "left-pane label"],
  ["Your audit request is in.", "no-name heading fallback"],
  [
    "We have your Growth System Audit request. Ryan will review your answers and look at how your current website and follow-up process connect.",
    "no-business supporting copy"
  ],
  [
    "Expect a personal reply by email within two business days.",
    "timing line"
  ],
  ["What happens next", "next-steps heading"],
  ["We review your answers.", "step 1"],
  [
    "We examine the gaps across discovery, lead handling, and customer follow-up.",
    "step 2"
  ],
  ["Ryan replies with the clearest next step.", "step 3"],
  [
    "No automated recommendation. No generic score. A real person reviews your request.",
    "reassurance line"
  ],
  ["Return to website", "primary button label"],
  ["Need to add something? Email ", "secondary contact link"]
];
const missingCopy = SUCCESS_COPY.filter(([t]) => !successHtml.includes(t));
missingCopy.length === 0
  ? ok(`contact: all ${SUCCESS_COPY.length} approved success strings present`)
  : fail(
      `contact: success panel missing ${missingCopy.map(([, n]) => n).join(", ")}`
    );

/<a class="btn[^"]*" href="index\.html">Return to website<\/a>/.test(successHtml)
  ? ok("contact: Return to website links to index.html")
  : fail("contact: primary success button must link to index.html");
/<a href="mailto:hello@tnrgrowthagency\.com">hello@tnrgrowthagency\.com<\/a>/.test(
  successHtml
)
  ? ok("contact: secondary link is a mailto to hello@tnrgrowthagency.com")
  : fail("contact: success panel is missing the hello@ mailto link");
/id="audit-success-title"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="audit-success-title"/.test(
  successHtml
)
  ? ok("contact: success heading is programmatically focusable")
  : fail('contact: success heading needs tabindex="-1" so focus can move to it');
/id="audit-success-lede"/.test(successHtml)
  ? ok("contact: supporting line is addressable for personalisation")
  : fail("contact: supporting line needs id=audit-success-lede");

// Nothing that would turn this into a funnel step.
const UPSELL = [
  [/calendly|cal\.com|book a call|schedule a call|pick a time/i, "a calendar link"],
  [/<form\b/i, "another form"],
  [/pricing|\$\s?\d|per month|upgrade|package/i, "pricing or an upsell"]
].filter(([re]) => re.test(successHtml));
UPSELL.length === 0
  ? ok("contact: success panel adds no calendar, form, pricing, or upsell")
  : fail(`contact: success panel contains ${UPSELL.map(([, n]) => n).join(", ")}`);

// Nothing on this screen may promise an outcome we have not agreed to deliver.
const OVERPROMISE = [
  [/audit report|full report|written report|your report\b/i, "a promised report"],
  [/\bguarantee|guaranteed\b/i, "a guarantee"],
  [/more leads|new leads|generate leads|leads and revenue/i, "a leads promise"],
  [/\brevenue\b|\bROI\b|\bprofit\b/i, "a revenue promise"],
  [/\branking|rank higher|\bSEO results\b/i, "a rankings promise"],
  [/more reviews|five[- ]star|\bratings?\b/i, "a reviews promise"],
  [/reactivat|win back|\bwe(?:'|&rsquo;)?ll bring back\b/i, "a reactivation promise"],
  [
    /immediately|right away|within 24 hours|within an hour|instantly/i,
    "an immediate-response promise"
  ],
  [/your score|scored?\s+\d|\bwe recommend\b/i, "a fabricated score or recommendation"]
].filter(([re]) => re.test(successHtml));
OVERPROMISE.length === 0
  ? ok("contact: success copy promises no report, outcome, score, or instant reply")
  : fail(
      `contact: success copy contains ${OVERPROMISE.map(([, n]) => n).join(", ")}`
    );

console.log("\n== Audit success screen: personalisation is text, never markup ==");
// Visitor-supplied values reach the page only as text. One innerHTML anywhere
// near them would turn a submitted business name into executable markup.
/personalise\(firstName, business\);/.test(intake)
  ? ok("intake: personalisation runs from succeed()")
  : fail("intake: succeed() must personalise the panel");
/successHeading\.textContent = "Thanks, " \+ firstName \+ "\.";/.test(intake)
  ? ok('intake: heading is set with textContent ("Thanks, <first name>.")')
  : fail("intake: the personalised heading must be assigned with textContent");
/strong\.textContent = business;/.test(intake)
  ? ok("intake: business name is set with textContent")
  : fail("intake: the business name must be assigned with textContent");
/successLede\.appendChild\(\s*document\.createTextNode\(/.test(intake)
  ? ok("intake: supporting copy is rebuilt from text nodes")
  : fail("intake: supporting copy must be rebuilt from text nodes");
/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/.test(
  intake
)
  ? fail("intake: an HTML-writing sink appeared near visitor-supplied values")
  : ok("intake: no innerHTML, outerHTML, insertAdjacentHTML, or document.write");

// Both fallbacks: the static markup is already correct when a value is
// missing, and the helpers return "" rather than printing something odd.
/function firstNameOf\(raw\) \{[\s\S]*?if \(!v \|\| v\.indexOf\("@"\) !== -1[\s\S]*?return "";/.test(
  intake
)
  ? ok("intake: an unusable contact name falls back to the generic heading")
  : fail("intake: firstNameOf must return \"\" for an unusable name");
/function businessNameOf\(raw\) \{[\s\S]*?if \(!v \|\| v\.length > MAX_BUSINESS\) return "";/.test(
  intake
)
  ? ok("intake: a missing or overlong business name falls back gracefully")
  : fail("intake: businessNameOf must return \"\" when there is nothing usable");
/if \(firstName && successHeading\)/.test(intake) &&
/if \(!business \|\| !successLede\) return;/.test(intake)
  ? ok("intake: personalisation is skipped entirely when a value is missing")
  : fail("intake: personalisation must no-op when a value is missing");
/MAX_FIRST_NAME = \d+/.test(intake) && /MAX_BUSINESS = \d+/.test(intake)
  ? ok("intake: submitted values are length-capped before they reach the page")
  : fail("intake: submitted values need a length cap");
/overflow-wrap: break-word/.test(cssText)
  ? ok("styles: a long submitted name wraps instead of widening the pane")
  : fail("styles: the success heading needs a wrapping rule for long names");

// The values must be read while the fields still hold them.
/function succeed\(\) \{[\s\S]{0,400}?firstNameOf\(fieldValue\("name"\)\)[\s\S]{0,200}?businessNameOf\(fieldValue\("business_name"\)\)[\s\S]{0,120}?form\.reset\(\);/.test(
  intake
)
  ? ok("intake: both values are captured before form.reset()")
  : fail("intake: the submitted values must be read before form.reset()");

console.log("\n== Audit success screen: it can only follow a real 2xx ==");
/if \(res\.ok\) \{\s*\n\s*succeed\(\);/.test(intake)
  ? ok("intake: succeed() runs only inside the res.ok branch")
  : fail("intake: the res.ok guard in front of succeed() has changed");
// Call sites carry the semicolon; the definition and the prose comments do not.
const succeedCalls = (intake.match(/succeed\(\);/g) || []).length;
succeedCalls === 1
  ? ok("intake: exactly one succeed() call site, and it is the res.ok branch")
  : fail(`intake: ${succeedCalls} succeed() call sites, expected exactly 1`);
// The failure path must reach setStatus, never the panel.
const catchBlock = (intake.match(/\.catch\(function \(err\) \{[\s\S]*?\}\);/) || [""])[0];
/successPanel/.test(catchBlock)
  ? fail("intake: the failure path touches the success panel")
  : ok("intake: the failure path never touches the success panel");
/setSending\(false\);/.test(catchBlock) && /setStatus\(\s*\n?\s*"err"/.test(catchBlock)
  ? ok("intake: a failed send restores the controls and shows an error")
  : fail("intake: the failure path must restore the controls and show an error");
// Timeout, honeypot, missing endpoint, and unsafe endpoint all return early.
/if \(trap && trap\.value\) return;/.test(intake)
  ? ok("intake: a filled spam trap returns before anything is sent")
  : fail("intake: the spam trap must return before the request");
/if \(!endpoint\) \{[\s\S]*?setStatus\(\s*\n?\s*"info"[\s\S]*?return;/.test(intake)
  ? ok("intake: an unconfigured endpoint reports instead of confirming")
  : fail("intake: an unconfigured endpoint must not reach the panel");
/timedOut[\s\S]*?ctrl\.abort\(\)/.test(intake) && /REQUEST_TIMEOUT_MS/.test(intake)
  ? ok("intake: the request still aborts on timeout")
  : fail("intake: the request timeout has been lost");

console.log("\n== Audit success screen: controls, focus, and progress ==");
/successPanel\.hidden = false;/.test(intake)
  ? ok("intake: success panel is unhidden on success")
  : fail("intake: success panel is never unhidden");
/successHeading\.focus\(\);/.test(intake)
  ? ok("intake: focus moves to the success heading")
  : fail("intake: focus must move to the success heading after submission");
/function retire\(btn\)[\s\S]*?btn\.hidden = true;[\s\S]*?btn\.disabled = true;[\s\S]*?btn\.setAttribute\("tabindex", "-1"\);/.test(
  intake
)
  ? ok("intake: retire() hides, disables, and un-tabs a control")
  : fail("intake: retire() must hide, disable, and remove a control from the tab order");
const retired = ["backBtn", "nextBtn", "submitBtn"].filter(
  (b) => !new RegExp(`retire\\(${b}\\);`).test(intake)
);
retired.length === 0
  ? ok("intake: Back, Continue, and Submit are all retired after success")
  : fail(`intake: not retired after success: ${retired.join(", ")}`);
/if \(navWrap\) navWrap\.hidden = true;/.test(intake)
  ? ok("intake: the whole step-control row is hidden after success")
  : fail("intake: the step-control row must be hidden after success");
/progressFill\.style\.width = "100%";/.test(intake)
  ? ok("intake: the progress bar is filled to 100% on success")
  : fail("intake: the progress bar must reach 100% on success");
/progressLabel\.textContent = "Submitted";/.test(intake)
  ? ok('intake: the step counter reads "Submitted" on success')
  : fail('intake: the step counter must read "Submitted" on success');
/function succeed\(\)[\s\S]*?form\.reset\(\);/.test(intake)
  ? ok("intake: the form is still reset on success")
  : fail("intake: form.reset() on success has been lost");
/clearStatus\(\);\s*\n\s*personalise\(/.test(intake)
  ? ok("intake: the old status box is cleared, not left beside the panel")
  : fail("intake: the status box must be cleared when the panel appears");
/<footer class="wz-foot">/.test(contact)
  ? ok("contact: the legal footer is still on the page")
  : fail("contact: the legal footer must survive the success screen");

console.log("\n== Submit button label matches its own markup ==");
// A failed send restores the button. It used to restore a label the markup
// never had, silently renaming the control after any error.
const markupLabel = (contact.match(
  /<button[^>]*id="btn-submit"[^>]*>([^<]+)<\/button>/
) || [])[1];
const restoredLabel = (intake.match(/SUBMIT_IDLE_LABEL = "([^"]+)"/) || [])[1];
markupLabel && restoredLabel && markupLabel.trim() === restoredLabel
  ? ok(`intake: the restored idle label matches contact.html ("${restoredLabel}")`)
  : fail(
      `intake: restored label ${JSON.stringify(restoredLabel)} does not match the markup ${JSON.stringify(
        markupLabel && markupLabel.trim()
      )}`
    );
/submitBtn\.textContent = on \? "Sending…" : SUBMIT_IDLE_LABEL;/.test(intake)
  ? ok("intake: setSending restores the label from that one constant")
  : fail("intake: setSending must restore SUBMIT_IDLE_LABEL");
!/Submit application/.test(intake)
  ? ok('intake: the stale "Submit application" label is gone')
  : fail('intake: "Submit application" is still in js/intake.js');

console.log("\n== Audit success screen: styling stays inside the palette ==");
const doneCss = (cssText.match(
  /\/\* Successful submission[\s\S]*?\n\/\* Slim legal footer/
) || [""])[0];
doneCss
  ? ok("styles: success panel block found")
  : fail("styles: the success panel style block is missing");
/\.wz-done\[hidden\]\s*\{\s*display:\s*none/.test(cssText)
  ? ok("styles: .wz-done[hidden] is display:none")
  : fail("styles: .wz-done[hidden] must be display:none or it shows before submit");
/\.wz-nav\[hidden\]\s*\{\s*display:\s*none/.test(cssText)
  ? ok("styles: .wz-nav[hidden] is display:none")
  : fail("styles: .wz-nav[hidden] must be display:none or the controls survive success");

// No hard-coded colour anywhere in the panel, base or responsive.
const doneHex = doneCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
doneHex.length === 0
  ? ok("styles: success panel uses palette tokens only, no literal hex")
  : fail(`styles: success panel hard-codes ${doneHex.join(", ")}`);
const doneColorTokens = [
  ...new Set((doneCss.match(/var\((--[a-z0-9-]+)\)/g) || []))
].map((v) => v.slice(4, -1));
const undeclaredTokens = doneColorTokens.filter(
  (t) => !new RegExp(`\\n\\s*${t}:`).test(cssText)
);
undeclaredTokens.length === 0
  ? ok(`styles: all ${doneColorTokens.length} tokens the panel uses are declared`)
  : fail(`styles: success panel uses undeclared token(s): ${undeclaredTokens.join(", ")}`);

// The requested composition: Forge Black left, light right, Burnt Orange join.
/\.wz-done-main \{[^}]*background:\s*var\(--forge-black\)/.test(doneCss)
  ? ok("styles: left pane is Forge Black")
  : fail("styles: left pane must be Forge Black");
/\.wz-done-main \{[^}]*color:\s*var\(--forge-canvas\)/.test(doneCss)
  ? ok("styles: left pane type is Warm Canvas")
  : fail("styles: left pane type must be Warm Canvas");
/\.wz-done-aside \{[^}]*background:\s*var\(--wz-surface\)/.test(doneCss) &&
/\.wz-done-aside \{[^}]*color:\s*var\(--wz-ink\)/.test(doneCss)
  ? ok("styles: right pane is the light ground with Forge Black type")
  : fail("styles: right pane must be light with Forge Black type");
/\.wz-done-aside::before \{[^}]*background:\s*var\(--gold\)/.test(doneCss)
  ? ok("styles: a Burnt Orange rule joins the two panes")
  : fail("styles: the two panes need a Burnt Orange joining rule");

// Nothing trendy: no gradient, glass, glow, or external art.
const DECORATION = [
  [/gradient/i, "a gradient"],
  [/backdrop-filter/i, "a glass effect"],
  [/text-shadow|drop-shadow|box-shadow:\s*0 0 /i, "a glow"],
  [/url\(/i, "an external asset"]
].filter(([re]) => re.test(doneCss));
DECORATION.length === 0
  ? ok("styles: success panel adds no gradient, glass, glow, or external asset")
  : fail(`styles: success panel uses ${DECORATION.map(([, n]) => n).join(", ")}`);

// One entrance, opacity and transform only, off for reduced motion.
const doneKeyframes = (cssText.match(/@keyframes wz-done-in \{[\s\S]*?\n\}/) || [""])[0];
const animatedProps = [
  ...new Set((doneKeyframes.match(/^\s{4}([a-z-]+):/gm) || []))
].map((p) => p.trim().replace(":", ""));
doneKeyframes &&
animatedProps.length > 0 &&
animatedProps.every((p) => p === "opacity" || p === "transform")
  ? ok(`styles: the entrance animates only ${animatedProps.join(" and ")}`)
  : fail(
      `styles: the entrance must animate opacity/transform only, found ${animatedProps.join(", ") || "nothing"}`
    );
/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.wz-done \{\s*animation: none/.test(
  cssText.replace(/\.wz-step\.is-entering,\s*\n\s*/g, "")
) ||
/\.wz-step\.is-entering,\s*\n\s*\.wz-done \{\s*\n\s*animation: none !important;/.test(cssText)
  ? ok("styles: the entrance is switched off under prefers-reduced-motion")
  : fail("styles: the entrance must be disabled for reduced-motion users");

// The stacked layout, and only with tokens.
const doneMobile = (doneCss.match(/@media \(max-width: 860px\) \{[\s\S]*?\n\}\n/) || [""])[0];
/\.wz-done \{[^}]*grid-template-columns:\s*1fr/.test(doneMobile)
  ? ok("styles: the two panes stack on narrow screens")
  : fail("styles: the panes must stack on narrow screens");
/\.wz-done-actions \.btn \{[^}]*width:\s*100%/.test(doneCss)
  ? ok("styles: the primary button is full width")
  : fail("styles: the primary button must be full width");

console.log("\n== Public copy: no em or en dashes ==");
// Applies to the files a visitor's browser actually loads: every page, the
// site's JavaScript, and the stylesheet. Dev scripts and internal docs are
// not public copy and are not covered.
const DASH_PATTERNS = [
  [/—/g, "em dash"],
  [/–/g, "en dash"],
  [/&mdash;/gi, "&mdash;"],
  [/&ndash;/gi, "&ndash;"],
  [/&#8212;|&#x2014;/gi, "&#8212;"],
  [/&#8211;|&#x2013;/gi, "&#8211;"]
];
const PUBLIC_FILES = [
  ...htmlFiles,
  ...readdirSync(join(root, "js"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => `js/${f}`),
  "styles.css"
];
let dashHits = 0;
for (const f of PUBLIC_FILES) {
  const body = read(f);
  for (const [re, name] of DASH_PATTERNS) {
    const n = (body.match(re) || []).length;
    if (n) {
      dashHits += n;
      fail(`${f}: ${n} ${name}(s) — use a plain hyphen or reword`);
    }
  }
}
dashHits === 0
  ? ok(`public copy: no em or en dashes across ${PUBLIC_FILES.length} shipped files`)
  : fail(`${dashHits} long dash(es) in public website files`);

console.log(`\n${fails === 0 ? "PASS" : "FAIL"} — ${checks} checks passed, ${fails} failed.\n`);
process.exit(fails === 0 ? 0 : 1);
