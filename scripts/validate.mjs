#!/usr/bin/env node
/**
 * validate.mjs — focused checks for the Service Momentum static site.
 * No dependencies. Run: npm run validate  (or: node scripts/validate.mjs)
 *
 * Verifies structure, links, escaping, JSON-LD, the brand (SM logo, ads
 * palette, no TNR branding outside the legal operator lines), honest copy
 * (no pricing, no invented stats, sample data labelled, no client names),
 * the demo form's submission safeguards and A2P consent wording, video
 * budgets and accessibility, and the GitHub Pages surface.
 * Exits non-zero if anything fails.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LOGO_COLORS, SM_PALETTE, RETIRED_COLORS, LOGO_ASSETS } from "./brand-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Only pages that ship. Untracked drafts in the working tree are not the site.
let htmlFiles;
try {
  htmlFiles = execFileSync("git", ["ls-files", "--cached", "*.html"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !f.includes("/"));
} catch {
  htmlFiles = readdirSync(root).filter((f) => f.endsWith(".html"));
}
const LEGAL_PAGES = ["privacy.html", "terms.html", "sms-consent.html"];
const MARKETING_PAGES = htmlFiles.filter((f) => !LEGAL_PAGES.includes(f));

// Split so the protected customer's name is never stored verbatim in this
// repository, including in the validator that checks for it.
const PILOT_NAME = ["G", "avin"].join("");

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
const plainText = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&rsquo;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();

const idsByPage = {};
for (const f of htmlFiles) {
  idsByPage[f] = new Set([...read(f).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
}

console.log(`\n== Structure (${htmlFiles.length} shipped pages) ==`);
for (const f of htmlFiles) {
  const h = read(f);
  const titles = (h.match(/<title>/g) || []).length;
  titles === 1 ? ok(`${f}: one <title>`) : fail(`${f}: ${titles} <title> tags`);
  /<html lang="en">/.test(h) ? ok(`${f}: lang=en`) : fail(`${f}: missing lang`);
  /rel="canonical"/.test(h) ? ok(`${f}: canonical`) : fail(`${f}: missing canonical`);
  /name="viewport"/.test(h) ? ok(`${f}: viewport`) : fail(`${f}: missing viewport`);
  (h.match(/<h1\b/g) || []).length === 1 ? ok(`${f}: exactly one h1`) : fail(`${f}: needs exactly one h1`);
  /class="skip-link" href="#main"/.test(h) && /id="main"/.test(h)
    ? ok(`${f}: skip link reaches #main`)
    : fail(`${f}: skip link or #main missing`);
}

console.log("\n== Escaping (raw & outside entities) ==");
for (const f of htmlFiles) {
  const bad = [...read(f).matchAll(/&(?!amp;|lt;|gt;|quot;|#\d+;|[a-z]+;)/g)];
  bad.length === 0 ? ok(`${f}: clean`) : fail(`${f}: ${bad.length} raw ampersand(s)`);
}

console.log("\n== Email consistency ==");
for (const f of htmlFiles.concat(["js/site-config.js", "brand.config.json"])) {
  const emails = [...read(f).matchAll(/[A-Za-z0-9._%+-]+@tnrgrowthagency\.com/g)].map((m) => m[0]);
  const bad = emails.filter((e) => e !== "hello@tnrgrowthagency.com");
  bad.length === 0
    ? ok(`${f}: emails ok (${emails.length})`)
    : fail(`${f}: unexpected email(s): ${[...new Set(bad)].join(", ")}`);
}

console.log("\n== Internal links + anchors ==");
for (const f of htmlFiles) {
  const h = read(f).replace(/<!--[\s\S]*?-->/g, "");
  const refs = [...h.matchAll(/(?:href|src|poster)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    if (ref.startsWith("#")) {
      const id = ref.slice(1);
      if (id && !idsByPage[f].has(id)) fail(`${f}: dead anchor ${ref}`);
      continue;
    }
    const [rawPath, frag] = ref.split("#");
    const path = rawPath.split("?")[0];
    if (path && !existsSync(join(root, path))) fail(`${f}: missing file ${path}`);
    else if (frag && path.endsWith(".html") && idsByPage[path] && !idsByPage[path].has(frag))
      fail(`${f}: ${ref} -> #${frag} not found in ${path}`);
  }
  ok(`${f}: link refs checked (${refs.length})`);
}

console.log("\n== JSON-LD validity ==");
for (const f of htmlFiles) {
  for (const b of read(f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(b[1].trim());
      ok(`${f}: JSON-LD parses`);
    } catch (e) {
      fail(`${f}: JSON-LD invalid (${e.message})`);
    }
  }
}
const idx = read("index.html");
const faqLd = (idx.match(/"@type": "FAQPage"[\s\S]*?<\/script>/) || [""])[0];
const faqLdQs = [...faqLd.matchAll(/"name": "([^"]+)"/g)].map((m) => m[1]);
const faqHtmlQs = [...idx.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => plainText(m[1]));
faqLdQs.length === faqHtmlQs.length && faqLdQs.every((q, i) => q === faqHtmlQs[i])
  ? ok(`index: FAQ structured data matches the ${faqHtmlQs.length} visible questions`)
  : fail("index: FAQPage JSON-LD and the visible FAQ have drifted apart");

console.log("\n== Cache busting: every page asks for the same stylesheet ==");
const sheetVersions = [...new Set(htmlFiles.map((f) => (read(f).match(/<link rel="stylesheet" href="([^"]+)"/) || [])[1]))];
sheetVersions.length === 1
  ? ok(`assets: all pages request ${sheetVersions[0]}`)
  : fail(`assets: stylesheet URL differs across pages: ${sheetVersions.join(", ")}`);

console.log("\n== Published surface: local tooling stays out of GitHub Pages ==");
const pagesConfig = existsSync(join(root, "_config.yml")) ? read("_config.yml") : "";
const PRIVATE_BUILD_PATHS = ["scripts", "docs", "package.json", "README.md", "brand.config.json"];
const missingExclusions = PRIVATE_BUILD_PATHS.filter(
  (path) => !new RegExp("^\\s*-\\s*" + path.replace(".", "\\.") + "\\s*$", "m").test(pagesConfig)
);
missingExclusions.length === 0
  ? ok("pages: development tooling and internal docs are excluded")
  : fail(`pages: missing exclusions for ${missingExclusions.join(", ")}`);
!existsSync(join(root, ".nojekyll"))
  ? ok("pages: Jekyll processing remains enabled so exclusions take effect")
  : fail("pages: .nojekyll would bypass the development-file exclusions");
const excludedRefs = htmlFiles.filter((file) =>
  /(?:href|src)=["'](?:scripts|docs|package\.json|README\.md|brand\.config\.json)/i.test(read(file))
);
excludedRefs.length === 0
  ? ok("pages: production HTML does not depend on excluded paths")
  : fail(`pages: production HTML references excluded paths in ${excludedRefs.join(", ")}`);
existsSync(join(root, "CNAME")) && read("CNAME").trim() === "tnrgrowthagency.com"
  ? ok("CNAME unchanged (tnrgrowthagency.com)")
  : fail("CNAME changed or missing. The domain must not change without approval.");
existsSync(join(root, "robots.txt")) ? ok("robots.txt present") : fail("robots.txt missing");
/<urlset/.test(read("sitemap.xml")) && /tnrgrowthagency\.com\//.test(read("sitemap.xml"))
  ? ok("sitemap.xml valid + has canonical URLs")
  : fail("sitemap.xml malformed");

console.log("\n== Brand: Service Momentum, SM logo, no TNR branding ==");
for (const f of htmlFiles) {
  const h = read(f);
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  /Service Momentum/.test(title) && !/T&amp;R|TNR/i.test(title)
    ? ok(`${f}: title carries Service Momentum only`)
    : fail(`${f}: title must name Service Momentum and not T&R/TNR (${title})`);
  /<img src="assets\/sm-logo\.svg" width="\d+" height="\d+" alt="" \/>/.test(h)
    ? ok(`${f}: SM logo in the header, with intrinsic size`)
    : fail(`${f}: SM logo missing from the header lockup`);
  /href="favicon\.svg"/.test(h) ? ok(`${f}: favicon linked`) : fail(`${f}: favicon link missing`);
  // Chrome (head meta, header, footer) must not carry the old brand. The legal
  // operator line in the footer is the one approved mention.
  // Legal pages may name the operator in their meta description; their title,
  // header and footer are still checked.
  let head = (h.match(/<head>[\s\S]*?<\/head>/) || [""])[0].replace(/"legalName": "T\\u0026R Growth LLC",/, "");
  if (LEGAL_PAGES.includes(f)) head = head.replace(/<meta\s+name="description"[\s\S]*?\/>/, "");
  const header = (h.match(/<header[\s\S]*?<\/header>/) || [""])[0];
  const footer = (h.match(/<footer[\s\S]*?<\/footer>/) || [""])[0].replace(
    "Service Momentum is operated by T&amp;R Growth LLC.",
    ""
  );
  const chrome = (head + header + footer).replace(/tnrgrowthagency\.com/g, "");
  /T&amp;R|T\\u0026R|TNR|T&R/i.test(chrome)
    ? fail(`${f}: T&R/TNR branding in the page head, header or footer`)
    : ok(`${f}: no T&R/TNR branding in head, header or footer`);
}
// Marketing pages: the body may name the LLC only inside the consent wording.
const APPROVED_LEGAL_MENTIONS = [
  "I agree to receive text messages from T&amp;R Growth / ServiceMomentum",
  "I agree that T&amp;R Growth may contact me"
];
for (const f of MARKETING_PAGES) {
  let body = (read(f).match(/<main[\s\S]*?<\/main>/) || [""])[0];
  for (const m of APPROVED_LEGAL_MENTIONS) body = body.split(m).join("");
  /T&amp;R|TNR|T&R Growth/i.test(body.replace(/tnrgrowthagency\.com/g, ""))
    ? fail(`${f}: T&R/TNR branding in the page body outside the consent wording`)
    : ok(`${f}: body names T&R only inside the consent wording`);
}
existsSync(join(root, "assets/og-image.png"))
  ? ok("og-image.png present (1200x630 share card)")
  : fail("assets/og-image.png missing");
existsSync(join(root, "assets/apple-touch-icon.png"))
  ? ok("apple-touch-icon.png present")
  : fail("assets/apple-touch-icon.png missing");

for (const f of LOGO_ASSETS) {
  if (!existsSync(join(root, f))) {
    fail(`${f}: missing logo asset`);
    continue;
  }
  const svg = read(f);
  /<image\b|base64|data:image|\.(png|jpe?g|gif|webp)\b|<foreignObject/i.test(svg)
    ? fail(`${f}: embeds raster art; the logo must be vector paths`)
    : ok(`${f}: vector paths only`);
  const paints = [...svg.matchAll(/fill="([^"]*)"/g)].map((m) => m[1].toUpperCase());
  const allowed = new Set(Object.values(LOGO_COLORS));
  const rogue = [...new Set(paints.filter((c) => !allowed.has(c)))];
  rogue.length === 0 && paints.includes(LOGO_COLORS.s) && paints.includes(LOGO_COLORS.m)
    ? ok(`${f}: S and M in the logo colours ${LOGO_COLORS.s} / ${LOGO_COLORS.m}`)
    : fail(`${f}: logo colours drifted (${rogue.join(", ") || "missing S or M colour"})`);
}

console.log("\n== Honest copy: no pricing, no invented stats, no client names ==");
for (const f of MARKETING_PAGES) {
  const h = read(f);
  const text = plainText(h);
  /\bsmall\b/i.test(text)
    ? fail(`${f}: says "small". Describe shops by trucks, never as small.`)
    : ok(`${f}: never calls a shop "small"`);
  const pricing = [
    [/\bpric(e|es|ing)\b/i, "price/pricing"],
    [/\$\s?\d[\d,]*\s*(\/|per)\s*(mo|month|year|yr)/i, "a monthly or yearly fee"],
    [/\bsetup fee\b|\bper month\b|\/mo\b/i, "a fee term"]
  ].filter(([re]) => re.test(text));
  pricing.length === 0 ? ok(`${f}: no pricing`) : fail(`${f}: pricing language: ${pricing.map(([, n]) => n).join(", ")}`);
  const banned = ["we guarantee", "guaranteed leads", "guaranteed results", "guaranteed revenue", "rank first", "generated $", "in revenue"];
  const hit = banned.filter((p) => text.toLowerCase().includes(p));
  hit.length === 0 ? ok(`${f}: no banned claims`) : fail(`${f}: banned phrase(s): ${hit.join(", ")}`);
  /aggregateRating|reviewRating|ratingValue|reviewCount/i.test(h)
    ? fail(`${f}: contains rating markup`)
    : ok(`${f}: no rating markup`);
}
for (const f of [...htmlFiles, "js/demo-form.js", "js/site.js", "styles.css", "brand.config.json"]) {
  new RegExp("\\b" + PILOT_NAME + "\\b", "i").test(read(f))
    ? fail(`${f}: names the pilot client. No client names until approved in writing.`)
    : ok(`${f}: no pilot client name`);
}
// Fake product data lives only between the sample markers, and every mock
// app surface says it is sample data.
const sampleStart = idx.indexOf("<!-- sample:start");
const sampleEnd = idx.indexOf("<!-- sample:end -->");
sampleStart > 0 && sampleEnd > sampleStart
  ? ok("index: product visuals are fenced by sample:start / sample:end")
  : fail("index: sample markers missing around the product visuals");
const sampleBlock = idx.slice(sampleStart, sampleEnd);
const apps = sampleBlock.split('class="app"').length - 1;
const labels = sampleBlock.split('<span class="sample">Sample data</span>').length - 1;
apps > 0 && apps === labels
  ? ok(`index: all ${apps} product visuals are labelled "Sample data"`)
  : fail(`index: ${apps} product visual(s) but ${labels} "Sample data" label(s)`);
const outsideSample = plainText(idx.slice(0, sampleStart) + idx.slice(sampleEnd));
const invented = [
  [/\b\d+(\.\d+)?\s*%/g, "a percentage figure"],
  [/\$\s?\d/g, "a dollar figure"],
  [/\b\d+(\.\d+)?\s*(star|stars)\b/gi, "a star rating"],
  [/\b\d[\d,]*\s+(reviews|customers served|jobs booked|leads generated)\b/gi, "a fabricated count"]
].filter(([re]) => re.test(outsideSample));
invented.length === 0
  ? ok("index: no figures, ratings or dollar amounts outside the labelled sample visuals")
  : fail(`index: contains ${invented.map(([, n]) => n).join(", ")} outside the sample visuals`);
const proof = (idx.match(/<section[^>]*id="proof"[\s\S]*?<\/section>/) || [""])[0];
proof && !/\d/.test(plainText(proof))
  ? ok("index: case study is a placeholder with no names or numbers")
  : fail("index: the case-study placeholder must not carry numbers until approved");

console.log("\n== Homepage: the eight sections, in order ==");
const SECTIONS = [
  ['class="hero"', "Hero"],
  ['id="problem"', "The problem"],
  ['id="how"', "How it works"],
  ['id="product"', "What you get"],
  ['id="videos"', "Videos"],
  ['id="proof"', "Proof"],
  ['id="faq"', "FAQ"],
  ['id="book"', "Final call to action"]
];
const order = SECTIONS.map(([sel]) => idx.indexOf(sel));
order.every((v) => v >= 0)
  ? ok(`index: all ${SECTIONS.length} sections present`)
  : fail(`index: missing ${SECTIONS.filter((_, i) => order[i] < 0).map(([, n]) => n).join(", ")}`);
order.every((v, i) => i === 0 || v > order[i - 1])
  ? ok("index: sections appear in the agreed order")
  : fail("index: sections are out of order");
plainText((idx.match(/<h1\b[\s\S]*?<\/h1>/) || [""])[0]) === "Your past customers are calling someone else."
  ? ok('index: hero headline is "Your past customers are calling someone else."')
  : fail("index: the approved hero headline changed");
/Want to see who'?s due in your book right now\?/.test(plainText((idx.match(/<section[^>]*id="book"[\s\S]*?<\/section>/) || [""])[0]))
  ? ok("index: final CTA asks the approved question")
  : fail("index: final CTA question changed");
["Is this a CRM?", "Do I have to learn software?", "What do you need from me?", "How long until it's live?"].every((q) =>
  faqHtmlQs.includes(q)
)
  ? ok("index: the four agreed FAQ questions are present")
  : fail("index: an agreed FAQ question is missing");
const bookCtas = [...idx.matchAll(/<a class="btn btn-primary[^"]*" href="([^"]+)">Book a demo<\/a>/g)];
bookCtas.length >= 2 && bookCtas.every((m) => /#book$/.test(m[1]))
  ? ok(`index: ${bookCtas.length} "Book a demo" buttons, all to the form`)
  : fail("index: Book a demo buttons missing or not pointing at #book");

console.log("\n== Video: budgets, posters, autoplay rules ==");
const MEDIA_BUDGET = { "media/hero-loop.mp4": 1.5e6, "media/vsl.mp4": 5e6 };
for (const [f, max] of Object.entries(MEDIA_BUDGET)) {
  if (!existsSync(join(root, f))) {
    fail(`${f}: missing`);
    continue;
  }
  const size = statSync(join(root, f)).size;
  size <= max
    ? ok(`${f}: ${(size / 1e6).toFixed(2)} MB (budget ${(max / 1e6).toFixed(1)} MB)`)
    : fail(`${f}: ${(size / 1e6).toFixed(2)} MB is over the ${(max / 1e6).toFixed(1)} MB budget`);
}
for (const f of htmlFiles) {
  const vids = [...read(f).matchAll(/<video\b[^>]*>/g)].map((m) => m[0]);
  for (const v of vids) {
    const poster = (v.match(/poster="([^"]+)"/) || [])[1];
    poster && existsSync(join(root, poster)) ? ok(`${f}: video has a poster (${poster})`) : fail(`${f}: video without a poster`);
    /aria-label="[^"]+"/.test(v) ? ok(`${f}: video is labelled`) : fail(`${f}: video has no aria-label`);
    if (/\bautoplay\b/.test(v)) {
      /\bmuted\b/.test(v) && /\bplaysinline\b/.test(v) && /\bloop\b/.test(v) && /id="hero-video"/.test(v)
        ? ok(`${f}: only the hero loop autoplays, muted and inline`)
        : fail(`${f}: autoplaying video must be the muted, inline hero loop`);
    } else {
      /preload="none"/.test(v)
        ? ok(`${f}: click-to-play video does not preload`)
        : fail(`${f}: click-to-play video must use preload="none"`);
    }
  }
}
/id="hero-video-toggle"/.test(idx) && /aria-pressed/.test(idx)
  ? ok("index: hero loop has a pause/play control")
  : fail("index: the autoplaying hero loop needs a pause control");
/prefers-reduced-motion/.test(read("js/site.js")) && /removeAttribute\("autoplay"\)/.test(read("js/site.js"))
  ? ok("site.js: reduced motion stops the hero loop")
  : fail("site.js: reduced motion must stop the hero loop");
/data-site-ready/.test(read("js/site.js")) && /data-site-ready/.test(idx)
  ? ok("reveal gate fails open if js/site.js does not load")
  : fail("reveal gate has no fail-open fallback");
for (const f of htmlFiles) {
  [...read(f).matchAll(/<script[^>]+src="(https?:)?\/\/[^"]+"/g)].length === 0
    ? ok(`${f}: no third-party scripts`)
    : fail(`${f}: external script(s) added`);
}

console.log("\n== Demo form: fields, consent, safeguards ==");
const form = read("js/demo-form.js");
const cfgJs = read("js/site-config.js");
const endpoint = (cfgJs.match(/formEndpoint:\s*"([^"]*)"/) || [])[1];
const mode = (cfgJs.match(/formEndpointMode:\s*"([^"]*)"/) || [])[1];
const APPROVED_ENDPOINT = "https://formspree.io/f/xqpklkny";
endpoint === APPROVED_ENDPOINT
  ? ok(`site-config: live Formspree endpoint unchanged (${APPROVED_ENDPOINT})`)
  : fail(`site-config: formEndpoint is ${JSON.stringify(endpoint)}, expected ${APPROVED_ENDPOINT}`);
mode === "formspree" ? ok('site-config: formEndpointMode is "formspree"') : fail(`site-config: formEndpointMode drifted to ${JSON.stringify(mode)}`);
const brandJson = JSON.parse(read("brand.config.json"));
["formEndpoint", "formEndpointMode", "formEndpointNote"].some((k) => k in brandJson)
  ? fail("brand.config.json: mirrors an endpoint key (js/site-config.js is the only source)")
  : ok("brand.config.json: no mirrored endpoint key");

const smsQuote = plainText((read("sms-consent.html").match(/<blockquote>([\s\S]*?)<\/blockquote>/) || [])[1] || "");
const FORM_PAGES = htmlFiles.filter((f) => /<form id="demo-form"/.test(read(f)));
FORM_PAGES.includes("index.html") && FORM_PAGES.includes("contact.html")
  ? ok("demo form is on the home page and contact.html")
  : fail(`demo form pages: ${FORM_PAGES.join(", ")} (expected index.html and contact.html)`);
for (const f of FORM_PAGES) {
  const h = read(f);
  ["name", "business_name", "email", "phone", "trade", "trucks", "notes", "sms_consent", "contact_consent"].every((n) =>
    new RegExp(`name="${n}"`).test(h)
  )
    ? ok(`${f}: all demo form fields present`)
    : fail(`${f}: a demo form field is missing`);
  /name="phone"[^>]*required/.test(h) ? fail(`${f}: phone must stay optional`) : ok(`${f}: phone is optional`);
  /name="sms_consent"[^>]*(checked|required)/.test(h)
    ? fail(`${f}: SMS consent must be optional and never pre-checked`)
    : ok(`${f}: SMS consent optional and unchecked`);
  /name="contact_consent"[^>]*required/.test(h) ? ok(`${f}: contact consent required`) : fail(`${f}: contact consent must be required`);
  const smsLabel = plainText((h.match(/name="sms_consent"[^>]*\/>\s*<span>([\s\S]*?)<\/span>\s*<\/label>/) || [])[1] || "");
  smsLabel && smsLabel === smsQuote
    ? ok(`${f}: SMS consent wording matches sms-consent.html word for word (A2P)`)
    : fail(`${f}: SMS consent wording differs from the sms-consent.html quote`);
  const hp = /<input[^>]*name="_gotcha"[^>]*>/.exec(h);
  hp && /tabindex="-1"/.test(hp[0]) && /class="hp"/.test(h)
    ? ok(`${f}: spam trap present, hidden and out of the tab order`)
    : fail(`${f}: spam trap missing or reachable`);
  /<script src="js\/site-config\.js"><\/script>[\s\S]*js\/demo-form\.js/.test(h)
    ? ok(`${f}: site-config loads before the form script`)
    : fail(`${f}: js/site-config.js must load before js/demo-form.js`);
}
/\.hp\s*\{[^}]*left:\s*-9999px/.test(read("styles.css"))
  ? ok("styles: spam trap positioned off-screen")
  : fail("styles: .hp must position the spam trap off-screen");
const FORM_RULES = [
  [/function endpointIsSafe/, "endpoint is safety-checked before any request"],
  [/u\.protocol !== "https:"/, "refuses non-https endpoints (localhost excepted for the mock)"],
  [/zentradesk\|middleware/, "refuses the tenant-scoped client-booking backend"],
  [/REQUEST_TIMEOUT_MS/, "requests time out instead of hanging"],
  [/AbortController/, "aborts a stalled request"],
  [/body\.errors/, "surfaces the provider's own error messages"],
  [/if \(k === HONEYPOT\) return;/, "spam-trap value is never transmitted"],
  [/if \(trap && trap\.value\) return;/, "a filled spam trap stops the submission silently"],
  [/not connected to a submission service yet/, "honest not-connected message (success never faked)"],
  [/data\.sms_consent = "no"/, "records an explicit SMS refusal"],
  [/meta_product[\s\S]*meta_source[\s\S]*meta_submitted_at/, "submission carries product, source and timestamp metadata"],
  [/_replyto[\s\S]*_subject/, "formspree mode sets _replyto and _subject"],
  [/SMS_NEEDS_PHONE/, "SMS consent requires a phone number"]
];
for (const [re, label] of FORM_RULES) re.test(form) ? ok(`demo-form: ${label}`) : fail(`demo-form: must ensure ${label}`);
const succeedCalls = form.match(/succeed\(\)/g) || [];
succeedCalls.length === 2 && /if \(res\.ok\) return succeed\(\);/.test(form)
  ? ok("demo-form: success is shown only from the res.ok branch")
  : fail("demo-form: succeed() must run only after a 2xx response");
existsSync(join(root, "scripts/mock-endpoint.mjs")) ? ok("scripts/mock-endpoint.mjs present (dev-only)") : fail("scripts/mock-endpoint.mjs missing");
htmlFiles.some((f) => /localhost:8125|mock-endpoint|__qa\//.test(read(f)))
  ? fail("a page references a local mock endpoint")
  : ok("no page references a local mock endpoint");

console.log("\n== Palette: the ads colours, centralized, legible ==");
const css = read("styles.css");
const missingPalette = Object.entries(SM_PALETTE).filter(([, hex]) => !new RegExp(hex + "\\b", "i").test(css));
missingPalette.length === 0
  ? ok(`styles: all ${Object.keys(SM_PALETTE).length} ads palette colours declared`)
  : fail(`styles: palette colours missing: ${missingPalette.map(([n]) => n).join(", ")}`);
const paletteEnd = css.indexOf("\n}", css.indexOf(":root {"));
const strayHex = [...new Set(css.slice(paletteEnd).match(/#[0-9a-fA-F]{3,8}\b/g) || [])];
strayHex.length === 0
  ? ok("styles: no hard-coded hex below the palette block")
  : fail(`styles: hard-coded colour(s) outside the palette block: ${strayHex.slice(0, 6).join(", ")}`);
const shipped = [
  ...htmlFiles,
  "styles.css",
  "favicon.svg",
  ...readdirSync(join(root, "assets")).filter((f) => f.endsWith(".svg")).map((f) => "assets/" + f)
];
let retiredHits = 0;
for (const f of shipped) {
  const hits = RETIRED_COLORS.filter((c) => new RegExp(c + "\\b", "i").test(read(f)));
  if (hits.length) {
    retiredHits += hits.length;
    fail(`${f}: retired colour(s) returned: ${hits.join(", ")}`);
  }
}
retiredHits === 0 ? ok(`no retired Forge or navy/gold colour in ${shipped.length} shipped files`) : fail(`${retiredHits} retired colour reference(s)`);

const hexOf = (name) => (css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
const lum = (hex) => {
  const ch = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const PAIRS = [
  ["body text on deep navy", "sm-text", "sm-navy-deep", 4.5],
  ["muted text on deep navy", "sm-mute", "sm-navy-deep", 4.5],
  ["muted text on card navy", "sm-mute", "sm-navy-lift", 4.5],
  ["blue accent text on deep navy", "sm-blue", "sm-navy-deep", 4.5],
  ["button text on button blue", "sm-white", "sm-blue-strong", 4.5],
  ["button text on pressed blue", "sm-white", "sm-blue-press", 4.5],
  ["ink on paper (form, mock app)", "sm-ink", "sm-paper", 4.5],
  ["muted ink on paper", "sm-ink-mute", "sm-paper", 4.5],
  ["muted ink on white", "sm-ink-mute", "sm-white", 4.5],
  ["due pill", "sm-due-ink", "sm-due-bg", 4.5],
  ["booked pill", "sm-booked-ink", "sm-booked-bg", 4.5],
  ["done pill", "sm-done-ink", "sm-done-bg", 4.5],
  ["focus ring on deep navy", "focus", "sm-navy-deep", 3]
];
for (const [label, fg, bg, min] of PAIRS) {
  const a = hexOf(fg);
  const b = hexOf(bg);
  if (!a || !b) {
    fail(`contrast: token --${!a ? fg : bg} not found`);
    continue;
  }
  const r = contrast(a, b);
  r >= min ? ok(`contrast: ${label} = ${r.toFixed(2)}:1 (needs ${min})`) : fail(`contrast: ${label} = ${r.toFixed(2)}:1, below ${min}`);
}
/@media \(prefers-reduced-motion: reduce\)/.test(css) ? ok("styles: prefers-reduced-motion honoured") : fail("styles: no reduced-motion block");

console.log("\n== Legal pages: A2P wording kept, form described accurately ==");
for (const f of LEGAL_PAGES) {
  const h = read(f);
  /T&amp;R Growth LLC/.test(h) ? ok(`${f}: still names the legal operator, T&R Growth LLC`) : fail(`${f}: must name T&R Growth LLC`);
  /Growth System Audit|audit form/i.test(h)
    ? fail(`${f}: still describes the retired Growth System Audit form`)
    : ok(`${f}: describes the demo request form`);
}

console.log(`\n${checks} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
