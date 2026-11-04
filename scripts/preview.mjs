/** Local-only preview and regression fixtures. No production requests permitted.
 * Run: node scripts/preview.mjs. Static GitHub Pages never executes this file.
 * The demo form on / and /contact.html posts to a local mock; the source
 * configuration is never rewritten. ?qa=error or ?qa=timeout makes the mock fail.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.mp4':'video/mp4'};
const stats = {requests:0, payloads:[]};
createServer(async (req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Cache-Control','no-store');
  // Defense in depth: even a broken fixture cannot contact Formspree.
  res.setHeader('Content-Security-Policy', "connect-src 'self'; form-action 'none'; object-src 'none'");
  if (url.pathname === '/__qa/stats') { res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(stats)); }
  if (req.method === 'POST' && url.pathname === '/__qa/submit') {
    let body=''; for await (const chunk of req) body+=chunk;
    stats.requests++;
    const fields = Object.fromEntries([...body.matchAll(/name="([^"]+)"\r?\n\r?\n([\s\S]*?)\r?\n--/g)].map(m=>[m[1],m[2]]));
    stats.payloads.push({fields, contentType:req.headers['content-type']});
    console.log('Local mock submission', stats.requests, 'fields:', Object.keys(fields).join(', '));
    res.setHeader('Content-Type','application/json');
    if (url.searchParams.get('mode')==='timeout') return setTimeout(()=>res.end('{"ok":true}'),22000);
    if (url.searchParams.get('mode')==='error') {res.statusCode=422;return res.end('{"errors":[{"message":"Local test: provider rejected this submission."}]}');}
    return res.end('{"ok":true}');
  }
  if(req.method!=='GET' && req.method!=='HEAD'){res.statusCode=405;return res.end();}
  try {
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if(!path.startsWith(root + '/')) throw Error('path');
    let content = await readFile(path);
    const qa=url.searchParams.get('qa')||'';
    if(extname(path)==='.html' && /js\/demo-form\.js/.test(content.toString())) {
      const mode=['error','timeout'].includes(qa)?qa:'success';
      const setup=`<script>window.TNR_CONFIG.formEndpoint=location.origin+'/__qa/submit?mode=${mode}';</script>`;
      content=content.toString().replace('<script src="js/demo-form.js"',setup+'<script src="js/demo-form.js"');
    }
    res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');
    res.end(req.method==='HEAD'?'':content);
  } catch {res.statusCode=404;res.end('Not found');}
}).listen(8000,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:8000 (local mock only; external submissions blocked)'));
