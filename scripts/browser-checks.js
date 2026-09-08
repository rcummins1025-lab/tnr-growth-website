/* Local-only DOM regression fixtures, injected by scripts/preview.mjs.
 * Open fixtures one at a time: the mock server keeps a shared request counter.
 * Never include this file in a production page. It does not replace intake.js.
 */
(async function () {
  'use strict';
  const fixture = new URLSearchParams(location.search).get('qa');
  if (!fixture || !['localhost', '127.0.0.1'].includes(location.hostname)) return;
  const report = {fixture, page: location.pathname, status: 'running', checks: [], observations: {}};
  const panel = document.createElement('pre');
  panel.id = 'qa-report';
  panel.setAttribute('aria-label', 'Local regression test results');
  panel.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-width:1000px;margin:32px auto;padding:20px;background:#fff;color:#171a1f;border:2px solid #171a1f;font:14px/1.5 monospace;';
  document.body.appendChild(panel);
  function publish() {
    const json = JSON.stringify(report, null, 2);
    panel.textContent = json;
    document.documentElement.dataset.qaStatus = report.status;
    document.documentElement.dataset.qaReport = json;
  }
  function check(name, passed, detail) {
    report.checks.push({name, passed: Boolean(passed), ...(detail === undefined ? {} : {detail})});
    publish();
  }
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function until(predicate, maxMs, label) {
    const start = performance.now();
    while (!predicate()) {
      if (performance.now() - start > maxMs) throw new Error('Timed out waiting for ' + label);
      await pause(30);
    }
  }
  const select = (selector) => {
    const node = document.querySelector(selector);
    if (!node) throw new Error('Missing fixture target: ' + selector);
    return node;
  };
  const exposed = (node) => {
    if (!node || !node.getClientRects().length) return false;
    for (let el = node; el && el.nodeType === 1; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (el.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  async function stats() {
    const response = await fetch('/__qa/stats', {cache: 'no-store'});
    if (!response.ok) throw new Error('Local stats unavailable');
    return response.json();
  }
  publish();
  try {
    if (document.readyState === 'loading') await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, {once: true}));
    if (location.pathname.endsWith('contact.html')) {
      if (!['success', 'error', 'timeout', 'trap', 'invalid', 'race'].includes(fixture)) throw new Error('Unknown contact fixture');
      const endpoint = new URL(window.TNR_CONFIG.formEndpoint);
      if (endpoint.origin !== location.origin || endpoint.pathname !== '/__qa/submit') throw new Error('Refusing a non-local test submission');
      check('Preview endpoint is same-origin local mock', true);
      const before = await stats();
      const form = select('#audit-form');
      const steps = [...form.querySelectorAll('.form-step')];
      const next = select('#btn-next');
      const back = select('#btn-back');
      const submit = select('#btn-submit');
      const success = select('#audit-success');
      const status = select('#form-status');
      const current = () => steps.findIndex((step) => !step.hidden);
      const focused = (index) => document.activeElement === steps[index].querySelector('h2, h3');
      check('Initial audit exposes only the first step', current() === 0 && steps.filter((step) => !step.hidden).length === 1);
      check('Initial render does not steal focus to a question', !steps.some((step) => step.contains(document.activeElement)));
      check('Success is hidden before any request', success.hidden && !exposed(success));
      if (fixture === 'race') {
        const first = steps[0].querySelector('input[type="radio"]');
        first.dispatchEvent(new Event('pointerdown', {bubbles: true}));
        first.click();
        next.click();
        check('Continue during pointer delay advances exactly once immediately', current() === 1 && focused(1));
        // Answer the next question so an incorrectly retained timer could advance it.
        steps[1].querySelector('input[type="radio"]').click();
        await pause(600);
        check('Pending pointer timer cannot skip the next answered question', current() === 1);
        const alternative = steps[1].querySelectorAll('input[type="radio"]')[1];
        alternative.dispatchEvent(new Event('pointerdown', {bubbles: true}));
        alternative.click();
        back.click();
        await pause(600);
        check('Back cancels a queued pointer advancement and restores focus', current() === 0 && focused(0));
        check('Back keeps the prior answer selected', first.checked);
        check('Navigation race does not submit', (await stats()).requests === before.requests && success.hidden);
      } else {
        const selections = [];
        for (let index = 0; index < 7; index++) {
          const radio = steps[index].querySelector('input[type="radio"]');
          if (!radio) throw new Error('Expected a qualification radio on step ' + (index + 1));
          radio.click(); // No pointerdown: exercise explicit keyboard-style Continue.
          selections.push(radio);
          if (index === 0) {
            await pause(500);
            check('Radio selection without pointer commit does not auto-advance', current() === 0);
          }
          next.click();
          check('Continue to step ' + (index + 2) + ' moves focus to its heading', current() === index + 1 && focused(index + 1));
          if (index === 0) {
            back.click();
            check('Back restores the selected answer and heading focus', current() === 0 && radio.checked && focused(0));
            next.click();
          }
        }
        const fields = {business_name: 'Test Service', name: 'Test Operator', email: 'test@example.invalid', service_area: 'Test region'};
        for (const [name, value] of Object.entries(fields)) {
          const field = form.elements.namedItem(name);
          field.value = value;
          field.dispatchEvent(new Event('input', {bubbles: true}));
          field.dispatchEvent(new Event('change', {bubbles: true}));
        }
        const consent = form.elements.namedItem('contact_consent');
        consent.checked = fixture !== 'invalid';
        consent.dispatchEvent(new Event('change', {bubbles: true}));
        if (fixture === 'trap') form.elements.namedItem('_gotcha').value = 'Local test trap';
        const started = performance.now();
        submit.click();
        if (fixture === 'trap' || fixture === 'invalid') {
          await pause(300);
          check('Blocked submit sends zero requests', (await stats()).requests === before.requests);
          check('Blocked submit never shows success', success.hidden && !exposed(success));
          check('Blocked submit keeps answers available', !submit.disabled && selections.every((radio) => radio.checked));
          if (fixture === 'invalid') check('Missing required consent has a visible field error', !consent.checkValidity() && [...steps[7].querySelectorAll('.form-error')].some((el) => exposed(el) && el.textContent.trim()));
        } else {
          check('Pending request hides success and disables submit', success.hidden && submit.disabled);
          // A second submit event must be rejected by intake's own guard, even
          // when it bypasses the disabled button's native click protection.
          form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
          if (fixture === 'success') {
            await until(() => !success.hidden, 5000, 'real local 2xx confirmation');
            check('Accepted request reveals the static confirmation', exposed(success));
            check('Success focuses its heading', document.activeElement === select('#audit-success-title'));
            check('Success retires all step controls', [back, next, submit].every((el) => el.hidden && el.disabled && el.tabIndex === -1) && select('.wz-nav').hidden);
            check('Success hides every question and completes progress', steps.every((step) => step.hidden) && select('.progress-label').textContent === 'Submitted' && select('.progress-fill').style.width === '100%');
            check('Success never echoes submitted personal values', Object.values(fields).every((value) => !success.textContent.includes(value)));
          } else {
            await until(() => !submit.disabled && !status.hidden && status.classList.contains('err'), fixture === 'timeout' ? 23000 : 5000, 'honest submission error');
            check('Failed request never reveals success', success.hidden && !exposed(success));
            check('Failure restores submit and back controls', !submit.disabled && !back.disabled && !submit.hidden && submit.textContent.trim() === 'Submit audit');
            check('Failure retains contact and qualification answers', Object.entries(fields).every(([name, value]) => form.elements.namedItem(name).value === value) && selections.every((radio) => radio.checked) && consent.checked);
            if (fixture === 'error') check('Provider rejection text reaches the visitor', status.textContent.includes('Local test: provider rejected this submission.'));
            if (fixture === 'timeout') {
              const elapsed = Math.round(performance.now() - started);
              report.observations.timeoutElapsedMs = elapsed;
              check('Actual request timeout produces an honest retry message', elapsed >= 19500 && elapsed < 22500 && status.textContent.includes('That took too long to send.'));
            }
          }
          const after = await stats();
          check('Duplicate submit is blocked: exactly one local request', after.requests - before.requests === 1);
          const payload = after.payloads[before.payloads.length];
          check('Local mock received the real multipart form body', payload && /multipart\/form-data/.test(payload.contentType) && payload.fields.email === fields.email && payload.fields.contact_consent === 'yes');
          check('Payload strips honeypot and retains referral metadata', payload && !('_gotcha' in payload.fields) && payload.fields.referral_source === 'direct' && Boolean(payload.fields.meta_submitted_at));
        }
      }
    } else {
      const rows = [...document.querySelectorAll('.stack .jrn')];
      const initialText = rows.map((row) => row.textContent.trim());
      check('Seven lifecycle values exist in reading order at initial render', rows.map((row) => row.dataset.beat).join(',') === '1,2,3,4,5,6,7' && initialText.every(Boolean));
      check('Every lifecycle value is initially readable', rows.every(exposed));
      const seen = new Set();
      let rowsAlwaysReadable = true;
      const sample = () => {
        rows.forEach((row) => {if (row.classList.contains('is-lit')) seen.add(row.dataset.beat);});
        rowsAlwaysReadable = rowsAlwaysReadable && rows.every(exposed);
      };
      const watcher = new MutationObserver(sample);
      watcher.observe(select('.stack'), {attributes: true, subtree: true, attributeFilter: ['class']});
      sample();
      if (!['nojs', 'missing-motion', 'no-observer', 'reduced'].includes(fixture)) select('.stack').scrollIntoView({block: 'center', behavior: 'instant'});
      await pause(2850);
      sample();
      watcher.disconnect();
      report.observations.highlightedBeats = [...seen];
      check('Motion never hides or rewrites lifecycle data', rowsAlwaysReadable && rows.every((row, i) => row.textContent.trim() === initialText[i]));
      check('No highlight remains after the bounded sequence', rows.every((row) => !row.classList.contains('is-lit')));
      if (['nojs', 'missing-motion', 'no-observer', 'reduced'].includes(fixture)) {
        check('Fallback leaves the motion gate open', !document.documentElement.classList.contains('motion'));
        check('Fallback runs no decorative highlight sequence', seen.size === 0);
        check('Fallback reveals supporting homepage content', [...document.querySelectorAll('.band-head, .flow-step, .pillar > *, .proof, .fit, .nofit')].every(exposed));
      } else {
        check('Normal motion visits all seven beats once', [...seen].join(',') === '1,2,3,4,5,6,7' && select('.stack').classList.contains('journey-done'));
      }
      if (fixture === 'no-observer') check('Fixture removed IntersectionObserver', !('IntersectionObserver' in window));
      if (fixture === 'reduced') check('Reduced preference suppresses decorative rings in CSS', matchMedia('(prefers-reduced-motion: reduce)').matches && rows.every((row) => Number(getComputedStyle(row, '::after').opacity) === 0));
      if (fixture === 'nojs') check('No production scripts execute in script-disabled fixture', [...document.scripts].every((script) => script.src.endsWith('/scripts/browser-checks.js')));
    }
  } catch (error) {
    check('Fixture completes without an exception', false, error.message);
  }
  report.status = report.checks.every((item) => item.passed) ? 'passed' : 'failed';
  publish();
})();
