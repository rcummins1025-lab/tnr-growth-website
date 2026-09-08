#!/usr/bin/env node
/**
 * mock-endpoint.mjs — a throwaway local stand-in for the lead endpoint.
 *
 * DEV TOOLING ONLY. It exists so the real submission path can be exercised
 * end-to-end — both `formEndpointMode` encodings, the success branch, the
 * error branch, the timeout branch — WITHOUT creating a Formspree account,
 * wiring a live endpoint, or sending anyone's data anywhere. It stores nothing,
 * and it is never referenced or executed by the production website.
 *
 * NOTE ON VISIBILITY: _config.yml excludes scripts/ from the GitHub Pages
 * build, so this file is not published on the website. The source repository
 * may still be shared, so this file must continue to contain no secrets,
 * credentials, account identifiers, or personal data.
 *
 *   node scripts/mock-endpoint.mjs        # or: npm run mock
 *
 * Point the form at it for the duration of the test — http://localhost is the
 * one non-https target intake.js allows.
 *
 * RESTORE THE REAL ENDPOINT AFTERWARDS, NOT AN EMPTY STRING.
 * js/site-config.js is live: formEndpoint is https://formspree.io/f/xqpklkny
 * with formEndpointMode "formspree". Setting it back to "" would silently
 * disconnect the real form, and scripts/validate.mjs fails if it drifts from
 * the approved endpoint.
 *
 * Safest of all: leave the file alone and override window.TNR_CONFIG.formEndpoint
 * in the browser console for the test, so the committed config never changes.
 *
 * Behaviour is driven by the path so every branch is reachable:
 *   /f/test          -> 200 {"ok":true}                    success
 *   /f/test?fail=422 -> 422 {"errors":[{"message":"..."}]} field error
 *   /f/test?fail=500 -> 500 (no body)                      server error
 *   /f/test?slow=30  -> hangs 30s                          client timeout
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8125);

const cors = (res, req) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Max-Age", "600");
};

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

/** Pull field names out of a multipart body without parsing attachments. */
function summarise(raw, contentType) {
  if (/application\/json/i.test(contentType)) {
    try {
      return JSON.parse(raw);
    } catch {
      return { _unparsable: raw.slice(0, 200) };
    }
  }
  const out = {};
  for (const m of raw.matchAll(/name="([^"]+)"\r?\n\r?\n([\s\S]*?)\r?\n--/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

createServer((req, res) => {
  cors(res, req);
  if (req.method === "OPTIONS") return send(res, 204);
  if (req.method !== "POST") return send(res, 405, { errors: [{ message: "POST only." }] });

  const url = new URL(req.url, "http://localhost");
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const ct = req.headers["content-type"] || "";
    const fields = summarise(raw, ct);
    const encoding = /application\/json/i.test(ct) ? "json" : "formspree (multipart)";

    console.log(`\n── ${new Date().toISOString()} ─ ${req.method} ${url.pathname}`);
    console.log(`   encoding: ${encoding}`);
    console.log(`   fields (${Object.keys(fields).length}):`);
    for (const [k, v] of Object.entries(fields)) {
      console.log(`     ${k.padEnd(22)} ${String(v).slice(0, 70)}`);
    }
    for (const need of ["meta_product", "meta_source", "meta_submitted_at"]) {
      if (!(need in fields)) console.log(`   ⚠ missing metadata: ${need}`);
    }
    if ("_gotcha" in fields) console.log("   ⚠ honeypot value was transmitted — it should never be");

    const slow = Number(url.searchParams.get("slow") || 0);
    const fail = Number(url.searchParams.get("fail") || 0);
    const reply = () => {
      if (fail === 422)
        return send(res, 422, {
          errors: [{ field: "email", message: "That email address looks invalid." }]
        });
      if (fail) return send(res, fail);
      send(res, 200, { ok: true, next: "/thanks" });
    };
    slow ? setTimeout(reply, slow * 1000) : reply();
  });
}).listen(PORT, () => {
  console.log(`Mock lead endpoint on http://localhost:${PORT}/f/test`);
  console.log(
    "DEV ONLY — stores nothing, sends nothing, and is never referenced or executed"
  );
  console.log("by the production website. Ctrl-C to stop.");
});
