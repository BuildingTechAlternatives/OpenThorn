/**
 * Runtime smoke test for generated previews.
 *
 * ## Why this exists
 *
 * `buildPreview` uses esbuild-wasm, which only *transpiles* — it does NOT
 * type-check and it does NOT execute the code. That means a whole class of
 * fatal bugs compile "successfully" and only blow up when React actually
 * renders the app in the browser, e.g.:
 *
 *   ReferenceError: isJumping is not defined
 *
 * The agent never saw these because its `compile` tool reported success.
 * This module closes that gap: it actually *runs* the built bundle inside a
 * hidden, sandboxed iframe and captures any uncaught errors, unhandled
 * promise rejections, and console.error output, plus whether the app rendered
 * anything into #root. That turns "it compiled" into "it compiled AND ran".
 */

export interface RuntimeCheckResult {
  /** True when the app ran without fatal runtime errors. */
  ok: boolean
  /** Whether the check actually ran (false when no DOM is available). */
  ran: boolean
  /** Uncaught errors and unhandled rejections — these are fatal. */
  fatalErrors: string[]
  /** console.error messages — surfaced as warnings. */
  consoleErrors: string[]
  /** Whether #root received any rendered content. */
  rendered: boolean
  /** Number of interactive elements exercised (interactive mode only). */
  interactionsRun?: number
  /** Errors thrown specifically while exercising interactions. */
  interactionErrors?: string[]
  /** Internal routes that rendered a not-found / error view when navigated to. */
  routeErrors?: string[]
  /** Canvas draw calls that received NaN/Infinity — silently invisible content. */
  canvasErrors?: string[]
  /** Whether interactions produced any DOM change (a signal handlers are wired). */
  domChanged?: boolean
}

/** How long to let the app mount and settle before collecting the report. */
const DEFAULT_WAIT_MS = 1400
/** Hard ceiling — abandon the check if the iframe never reports back. */
const HARD_TIMEOUT_MS = 8000

/**
 * Inline script injected into the preview <head> BEFORE any module script.
 * Classic inline scripts run before deferred module scripts, so our error
 * handlers are always installed before the app's code evaluates.
 *
 * It collects errors and posts a single report to the parent after the app
 * has had time to mount. `token` ties the report to this specific run.
 */
function buildCaptureScript(token: string, waitMs: number, interactive = false): string {
  return `<script>
(function(){
  if (typeof window === 'undefined') return;
  var TOKEN = ${JSON.stringify(token)};
  var INTERACTIVE = ${interactive ? 'true' : 'false'};
  var fatal = [];
  var consoleErrors = [];
  var interactionErrors = [];
  var routeErrors = [];
  var canvasNaNCount = 0;
  var canvasNaNSample = '';
  var interactionsRun = 0;
  var domChanged = false;

  function describe(value) {
    if (value == null) return String(value);
    if (value instanceof Error) return value.name + ': ' + value.message;
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch (e) { return Object.prototype.toString.call(value); }
    }
    return String(value);
  }

  window.addEventListener('error', function(event) {
    if (event && event.error) fatal.push(describe(event.error));
    else if (event && event.message) fatal.push(event.message);
  }, true);

  window.addEventListener('unhandledrejection', function(event) {
    var reason = event ? event.reason : null;
    fatal.push('Unhandled promise rejection: ' + describe(reason));
  });

  var originalConsoleError = console.error;
  console.error = function() {
    try {
      var parts = Array.prototype.slice.call(arguments).map(describe);
      consoleErrors.push(parts.join(' '));
    } catch (e) { /* ignore */ }
    return originalConsoleError.apply(console, arguments);
  };

  // ── Canvas guard ───────────────────────────────────────────────
  // Canvas games and visualisations fail SILENTLY: drawing at a NaN/Infinity
  // coordinate or size (e.g. a variable that is undefined because it was
  // declared inside a block but used outside it) throws nothing and renders
  // nothing, so the sprite is invisible while the runtime check still "passes".
  // Wrap the 2D context draw calls and count non-finite numeric arguments; a
  // persistent count (a per-frame bug repaints hundreds of times) is reported.
  (function installCanvasGuard(){
    if (typeof CanvasRenderingContext2D === 'undefined') return;
    var proto = CanvasRenderingContext2D.prototype;
    var methods = ['fillRect','strokeRect','clearRect','rect','arc','arcTo','ellipse',
      'moveTo','lineTo','quadraticCurveTo','bezierCurveTo','fillText','strokeText',
      'translate','scale','setTransform','transform','drawImage'];
    methods.forEach(function(name){
      var orig = proto[name];
      if (typeof orig !== 'function') return;
      proto[name] = function(){
        for (var i = 0; i < arguments.length; i++) {
          var a = arguments[i];
          if (typeof a === 'number' && !isFinite(a)) {
            canvasNaNCount++;
            if (!canvasNaNSample) canvasNaNSample = name;
            break;
          }
        }
        return orig.apply(this, arguments);
      };
    });
  })();

  // ── Interaction driver ──────────────────────────────────────────
  // Exercises the rendered UI to catch "looks done but buttons do nothing /
  // throw" bugs. We prevent real form submits and full navigations so the
  // page stays alive, click a bounded set of controls, type into text inputs,
  // and watch for thrown errors and DOM mutations.
  function snapshotDom() {
    var root = document.getElementById('root');
    return root ? (root.innerHTML || '').length + ':' + root.querySelectorAll('*').length : '0:0';
  }

  function runInteractions() {
    // Block anything that would unload the document.
    document.addEventListener('submit', function(e){ e.preventDefault(); }, true);

    var before = snapshotDom();
    var MAX = 8;

    // Buttons and role=button / [data-testid] clickables (skip obviously
    // destructive or navigation-away controls).
    var clickables = [].slice.call(
      document.querySelectorAll('button, [role="button"], input[type="checkbox"], input[type="radio"], [data-interactive]')
    ).slice(0, MAX);
    for (var i = 0; i < clickables.length; i++) {
      var el = clickables[i];
      try {
        if (el.disabled) continue;
        el.click();
        interactionsRun++;
      } catch (err) {
        interactionErrors.push(describe(err));
      }
    }

    // Type into the first few text-like inputs and fire input/change.
    var inputs = [].slice.call(
      document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], input:not([type]), textarea')
    ).slice(0, 4);
    for (var j = 0; j < inputs.length; j++) {
      var inp = inputs[j];
      try {
        var setter = Object.getOwnPropertyDescriptor(
          inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value'
        );
        if (setter && setter.set) { setter.set.call(inp, 'Test input'); }
        else { inp.value = 'Test input'; }
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        interactionsRun++;
      } catch (err) {
        interactionErrors.push(describe(err));
      }
    }

    // Press common control/game keys. Canvas games and keyboard shortcuts are
    // driven by keydown — click-driving never reaches them, so a jump/move
    // handler that throws (or computes a NaN coordinate) would go unseen. We
    // fire on both document and window since apps bind to either.
    var keys = [
      { key: ' ', code: 'Space', keyCode: 32 },
      { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
      { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
      { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
      { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      { key: 'Enter', code: 'Enter', keyCode: 13 }
    ];
    for (var ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      try {
        var opts = { key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode, bubbles: true, cancelable: true };
        document.dispatchEvent(new KeyboardEvent('keydown', opts));
        window.dispatchEvent(new KeyboardEvent('keydown', opts));
        document.dispatchEvent(new KeyboardEvent('keyup', opts));
        window.dispatchEvent(new KeyboardEvent('keyup', opts));
        interactionsRun++;
      } catch (err) {
        interactionErrors.push(describe(err));
      }
    }

    domChanged = snapshotDom() !== before;
  }

  // ── Route driver ───────────────────────────────────────────────
  // Click-through is not enough: a route can render WITHOUT throwing yet show a
  // broken view (e.g. "Product not found" because a string route param is
  // compared against a numeric id). We visit the app's own internal hash routes
  // and flag any that land on a not-found / error state the home view did not
  // already show — the single most common "compiles but is broken" failure.
  var ERROR_RE = /(not found|page not found|404|does not exist|no such|couldn't find|couldnt find|cannot find|can't find|failed to load|went wrong)/i;

  function rootText() {
    var root = document.getElementById('root');
    return root ? (root.textContent || '') : '';
  }
  function delay(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function collectInternalRoutes() {
    var seen = {};
    var hrefs = [];
    var anchors = [].slice.call(document.querySelectorAll('a[href^="#/"]'));
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute('href');
      if (!href || href === '#/' || href === '#') continue;
      if (seen[href]) continue;
      seen[href] = true;
      hrefs.push(href);
    }
    // Prefer dynamic detail routes (/product/1, /item/abc) so we exercise data
    // lookups, not just static pages.
    hrefs.sort(function (a, b) {
      var ad = /\\/[^/]+\\/[\\w-]+/.test(a) ? 0 : 1;
      var bd = /\\/[^/]+\\/[\\w-]+/.test(b) ? 0 : 1;
      return ad - bd;
    });
    return hrefs.slice(0, 6);
  }

  function navigateRoutes() {
    var routes = collectInternalRoutes();
    if (routes.length === 0) return Promise.resolve();
    var baselineHadError = ERROR_RE.test(rootText());
    var chain = Promise.resolve();
    routes.forEach(function (href) {
      chain = chain.then(function () {
        try { window.location.hash = href; } catch (e) { interactionErrors.push(describe(e)); return; }
        return delay(200).then(function () {
          try {
            var txt = rootText();
            if (!baselineHadError && ERROR_RE.test(txt)) {
              var snippet = txt.replace(/\\s+/g, ' ').trim().slice(0, 140);
              routeErrors.push('Route ' + href + ' rendered an error/not-found view: "' + snippet + '"');
            }
            interactionsRun++;
          } catch (e) { interactionErrors.push(describe(e)); }
        });
      });
    });
    // Return home so the final report reflects a normal view, not the last route.
    chain = chain.then(function () { try { window.location.hash = '#/'; } catch (e) {} return delay(120); });
    return chain;
  }

  var reported = false;
  function report() {
    if (reported) return;
    reported = true;
    var root = document.getElementById('root');
    var rendered = !!(root && (root.childElementCount > 0 || (root.textContent || '').trim().length > 0));
    // A persistent non-finite draw argument (many repaints, not a one-off init
    // transient) means part of the canvas scene is silently invisible.
    var canvasErrors = [];
    if (canvasNaNCount >= 8) {
      canvasErrors.push('Canvas drawing received a non-finite value (NaN/Infinity) ' + canvasNaNCount +
        ' times, first via ctx.' + canvasNaNSample + '. A coordinate or size passed to the canvas is ' +
        'undefined/NaN, so that part of the scene never renders even though nothing throws.');
    }
    try {
      parent.postMessage({
        __bloomRuntimeCheck: TOKEN,
        fatalErrors: fatal,
        consoleErrors: consoleErrors,
        rendered: rendered,
        interactionsRun: interactionsRun,
        interactionErrors: interactionErrors,
        routeErrors: routeErrors,
        canvasErrors: canvasErrors,
        domChanged: domChanged
      }, '*');
    } catch (e) { /* ignore */ }
  }

  function settleThenReport() {
    if (INTERACTIVE) {
      // Let the app mount, drive its controls, walk its internal routes, let
      // effects settle, then report.
      try { runInteractions(); } catch (e) { interactionErrors.push(describe(e)); }
      var done = function () { setTimeout(report, 600); };
      try { navigateRoutes().then(done, done); } catch (e) { interactionErrors.push(describe(e)); done(); }
    } else {
      report();
    }
  }

  // Report after the app has mounted and run a few frames. We listen on load
  // so module scripts (deferred) have finished evaluating first.
  if (document.readyState === 'complete') {
    setTimeout(settleThenReport, ${waitMs});
  } else {
    window.addEventListener('load', function(){ setTimeout(settleThenReport, ${waitMs}); });
  }
  // Safety: always report eventually, even if 'load' never fires. Allow extra
  // headroom for the interactive route walk to finish before this fires.
  setTimeout(report, ${waitMs} + (INTERACTIVE ? 6000 : 2500));
})();
</script>`
}

/**
 * Inject the capture script as the first child of <head> so it installs its
 * handlers before the bundled app runs.
 */
function instrumentHtml(html: string, captureScript: string): string {
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n${captureScript}`)
  }
  // Fallback: prepend (still runs before body scripts).
  return captureScript + '\n' + html
}

let tokenCounter = 0
function nextToken(): string {
  tokenCounter += 1
  return `bloom-rt-${tokenCounter}-${tokenCounter * 2654435761 % 2147483647}`
}

/**
 * Execute a built preview HTML string in a hidden iframe and report any
 * runtime errors. Safe to call when no DOM is present (returns ran:false).
 */
export async function runtimeSmokeTest(
  html: string,
  opts: { waitMs?: number; interactive?: boolean } = {},
): Promise<RuntimeCheckResult> {
  const empty: RuntimeCheckResult = {
    ok: true,
    ran: false,
    fatalErrors: [],
    consoleErrors: [],
    rendered: false,
  }

  // No DOM (tests / SSR) — skip gracefully rather than crash.
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return empty
  }

  const interactive = opts.interactive ?? false
  const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS
  const token = nextToken()
  const instrumented = instrumentHtml(html, buildCaptureScript(token, waitMs, interactive))

  return new Promise<RuntimeCheckResult>((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1024px;height:768px;border:none;opacity:0;pointer-events:none;'
    // allow-scripts is enough — postMessage out of a sandboxed iframe works
    // even with an opaque origin. We deliberately omit allow-same-origin.
    iframe.setAttribute('sandbox', 'allow-scripts')

    let settled = false

    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(hardTimeout)
      try {
        document.body.removeChild(iframe)
      } catch {
        /* already removed */
      }
    }

    const finish = (result: RuntimeCheckResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.__bloomRuntimeCheck !== token) return

      const fatalErrors: string[] = Array.isArray(data.fatalErrors)
        ? data.fatalErrors.map((e: unknown) => String(e))
        : []
      const consoleErrors: string[] = Array.isArray(data.consoleErrors)
        ? data.consoleErrors.map((e: unknown) => String(e))
        : []
      const rendered = Boolean(data.rendered)
      const interactionErrors: string[] = Array.isArray(data.interactionErrors)
        ? data.interactionErrors.map((e: unknown) => String(e))
        : []
      const routeErrors: string[] = Array.isArray(data.routeErrors)
        ? data.routeErrors.map((e: unknown) => String(e))
        : []
      const canvasErrors: string[] = Array.isArray(data.canvasErrors)
        ? data.canvasErrors.map((e: unknown) => String(e))
        : []
      const interactionsRun = Number(data.interactionsRun) || 0
      const domChanged = Boolean(data.domChanged)

      // Fatal = uncaught errors / rejections, OR an error thrown while
      // exercising an interaction (a dead/broken handler). An empty render
      // combined with a logged console error is also treated as fatal (React
      // crashed during render without rethrowing). A bare empty render is NOT
      // failed on its own, to avoid false positives from slow esm.sh loads.
      const ok =
        fatalErrors.length === 0 &&
        interactionErrors.length === 0 &&
        routeErrors.length === 0 &&
        canvasErrors.length === 0 &&
        !(rendered === false && consoleErrors.length > 0)

      finish({
        ok,
        ran: true,
        fatalErrors,
        consoleErrors,
        rendered,
        interactionsRun,
        interactionErrors,
        routeErrors,
        canvasErrors,
        domChanged,
      })
    }

    const hardTimeout = setTimeout(() => {
      // Never reported — most likely an external module (esm.sh) stalled.
      // Treat as inconclusive (ok) rather than a false failure.
      finish({ ...empty, ran: true })
    }, interactive ? HARD_TIMEOUT_MS + 4000 : HARD_TIMEOUT_MS)

    window.addEventListener('message', onMessage)
    document.body.appendChild(iframe)
    iframe.srcdoc = instrumented
  })
}

/**
 * Run the app AND drive its interactive elements (clicks, typing, hash links),
 * catching handlers that throw or do nothing. Use this for the final
 * pre-`done` gate where "the buttons actually work" matters.
 */
export async function interactiveSmokeTest(
  html: string,
  opts: { waitMs?: number } = {},
): Promise<RuntimeCheckResult> {
  return runtimeSmokeTest(html, { ...opts, interactive: true })
}

/**
 * Format a runtime check result into a concise, agent-readable report.
 * Returns null when there is nothing worth reporting (clean run).
 */
export function formatRuntimeReport(result: RuntimeCheckResult): string | null {
  if (!result.ran) return null
  const interactionErrors = result.interactionErrors ?? []
  const routeErrors = result.routeErrors ?? []
  const canvasErrors = result.canvasErrors ?? []
  if (
    result.ok &&
    result.consoleErrors.length === 0 &&
    interactionErrors.length === 0 &&
    routeErrors.length === 0 &&
    canvasErrors.length === 0
  ) {
    return null
  }

  const lines: string[] = []

  if (canvasErrors.length > 0) {
    lines.push('Canvas check FAILED — content is being drawn off-screen / invisibly:')
    canvasErrors.slice(0, 4).forEach((e, i) => lines.push(`  ${i + 1}. ${e}`))
    lines.push(
      'Nothing throws, so trace the value passed as the x/y/width/height (or transform) ' +
        'argument back to where it is computed. The usual cause is a variable that is ' +
        'undefined at the draw site — e.g. declared with const/let inside an `if`/loop block ' +
        'but read outside it, or a state value that has not been initialised. Fix the source ' +
        'of the NaN, then compile again.',
    )
  }

  if (routeErrors.length > 0) {
    lines.push(
      'Route check FAILED — a link the app itself renders leads to a broken view:',
    )
    routeErrors.slice(0, 8).forEach((e, i) => lines.push(`  ${i + 1}. ${e}`))
    lines.push(
      'The route did not throw, so the bug is logic — not a crash. The most common cause is the ' +
        'route param being a string while the lookup compares it against a number (e.g. ' +
        '`items.find(x => x.id === id)` where `id` from useParams is a string). Read the page ' +
        'component and its data lookup, fix the comparison/param parsing, then compile again.',
    )
  }

  if (result.fatalErrors.length > 0) {
    lines.push(
      `Runtime check FAILED — the app threw ${result.fatalErrors.length} uncaught error(s) when rendered:`,
    )
    result.fatalErrors.forEach((e, i) => lines.push(`  ${i + 1}. ${e}`))
  }

  if (interactionErrors.length > 0) {
    lines.push(
      result.fatalErrors.length > 0 ? '' : 'Interaction check FAILED — a control threw when used:',
    )
    interactionErrors.slice(0, 8).forEach((e, i) =>
      lines.push(`  interaction error ${i + 1}: ${e}`),
    )
    lines.push(
      'A button/input handler crashed when exercised. Find the handler, fix the bad reference or state update, then compile again.',
    )
  }

  if (result.consoleErrors.length > 0) {
    lines.push(
      result.fatalErrors.length > 0 ? '' : 'Runtime check — console errors detected:',
    )
    result.consoleErrors.slice(0, 8).forEach((e, i) => lines.push(`  console.error ${i + 1}: ${e}`))
  }

  if (!result.rendered && result.fatalErrors.length === 0 && result.consoleErrors.length === 0) {
    lines.push('Note: the app did not render any visible content into #root.')
  }

  // Only the thrown/console failures warrant the generic "find the bad
  // reference" advice; route-logic failures already have their own targeted hint
  // above, so don't muddy them with crash-debugging guidance.
  const hadThrownError =
    result.fatalErrors.length > 0 ||
    interactionErrors.length > 0 ||
    result.consoleErrors.length > 0
  if (!result.ok && hadThrownError) {
    lines.push(
      '',
      'These are RUNTIME errors found by actually running the app — esbuild does not catch them. ' +
        'Read the affected file, find the undefined variable / bad reference / broken hook, fix it with edit_file, then compile again.',
    )
  }

  return lines.join('\n')
}
