**TypeDash release guide**

Prepared November 4, 2026. The static build and Vercel configuration are prepared. All 57 functional browser tests pass. The 32 ms keyboard-presentation target is currently unmet on this host, so the full release command fails that gate. Check [phase-6.md](./phase-6.md) before publishing.

**Local verification**

Use Node.js 24 (`.nvmrc`) and the committed npm lockfile:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run check:release
```

On Linux, install browser system dependencies with `npx playwright install --with-deps chromium firefox webkit`. Run the suite where native browser automation is available and authorized. The test runners own their local preview servers; ports 4173, 4184, and 4185 must be free. `check:release` runs lint, types, unit tests, production build, artifact/budget checks, engine benchmarking, HTTP smoke, the three-browser functional suite, and Chromium performance recording. It stops on failure.

The [GitHub Actions workflow](../.github/workflows/release-checks.yml) performs the functional/build checks on pushes and pull requests with Node 24 and Chromium, Firefox, and WebKit. It uploads test evidence for 14 days. It contains no publishing credentials or deploy step. A manual workflow run can enable `performance` to collect Chromium measurements on that runner; those numbers describe that runner, not a physical reference device.

On macOS, the test configuration isolates Firefox's app-data directories under ignored `node_modules/.cache/typedash-firefox`. This follows the [Mozilla app-data workaround](https://bugzilla.mozilla.org/show_bug.cgi?id=2069536) and avoids requesting access to personal Firefox data. TypeDash's controls have explicit zero tab indices, addressing the [macOS WebKit navigation behavior](https://github.com/microsoft/playwright/issues/41808) while preserving their DOM order. No global macOS or browser preferences are changed.

**Performance evidence**

| Check | Method | Target |
| --- | --- | --- |
| Initial assets | `npm run build` reports gzip sizes, including font, CSS, JS, favicon, and HTML. | JS ≤100,000 bytes; all initial assets ≤200,000 bytes. |
| Engine regression | `npm run benchmark:engine`: three warmups, ten 3,000-character traces at simulated 300 WPM, and 1,000 restart samples. | Reducer insertion p95 ≤4 ms; reducer restart p95 ≤100 ms. This excludes browser work. |
| Cold loading | `npm run test:performance`: five isolated Chromium contexts, disabled cache, 4× CPU slowdown, Fast 4G. LCP uses `PerformanceObserver`; readiness uses the input-binding mark. | Median LCP ≤1,500 ms; median input readiness ≤2,000 ms. |
| Native input | The interaction recorder timestamps `beforeinput` propagation through the app’s handlers. | p95 ≤4 ms. |
| Restart | Twenty restarts with 100 loaded results; record ready/focus rAF and native click-to-next-paint Event Timing. | p95 ≤100 ms, including the conservative rounding bound. |
| Feedback presentation | Collect native keyboard Event Timing outside tracing, and inspect a separate 160-key screenshot/paint trace on the reference environment. | p95 ≤32 ms, including the conservative rounding bound. rAF alone cannot establish this. |
| Stability | Compare listeners from application bundle script IDs and mounted words after repeated restarts. Preserve all listener counts to expose browser-tool additions. Record requests after loading History and the font. | Stable application listeners, ≤64 mounted words, no requests during typing/restart. |

The Fast 4G profile uses 1,012,500 download bytes/s, 168,750 upload bytes/s, and 165 ms latency, matching the adjusted values in [Chrome DevTools’ source](https://chromium.googlesource.com/devtools/devtools-frontend/+/HEAD/front_end/core/sdk/NetworkManager.ts). CPU slowdown uses the [DevTools emulation API](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/).

For the reference desktop, run `npm run test:performance -- --headed` with the display set to 60 Hz, no background workloads, and the window foregrounded. Record the machine, OS, browser version, display mode, and power state. The scripts record browser/machine metadata and frame cadence, but cannot certify physical display settings. A separate native-textarea case measures the browser's baseline with no TypeDash code.

The [Event Timing specification](https://www.w3.org/TR/event-timing/) rounds durations to 8 ms and permits a minimum observation threshold of 16 ms. The recorder adds 4 ms to observed durations for a conservative upper bound and counts unobserved short events with a conservative 16 ms bound. It verifies the native keyboard event count before enforcing the percentile. The presentation assertion uses these native next-paint values, not the pre-paint rAF proxy.

Chrome’s Performance panel can load `performance-results/browser-trace.json`. It contains 160 marked inputs, DOM-commit markers, paint/presentation events, and screenshots; screenshot recording can itself add overhead. Run `npm run analyze:trace` to summarize its native Event Timing durations and extract first/middle/last frames. Screenshot capture timestamps and `expected_display_time` estimates are not treated as actual presentation; Chromium explicitly describes the latter as an estimate in its [tracing implementation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/devtools/protocol/tracing_handler.cc). Keep the diagnostic trace separate from the untraced benchmark.

Generated files under `performance-results/` are ignored. Keep a dated copy of accepted reports under `docs/performance/`, along with the reviewed commit and validation environment. Do not describe reducer-only, headless, warm-cache, or unthrottled results as the physical-device or cold-load release result.

**Vercel configuration and deployment**

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | The repository directory containing `package.json` |
| Node version | 24.x |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |
| Environment variables | None |
| Application backend/database/API keys | None |

These build fields are stored in `vercel.json` using [Vercel’s project configuration](https://vercel.com/docs/project-configuration/vercel-json). Node 24 is supported for [Vercel builds](https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions). The app has no server functions. Its single root document uses dialogs and `#main` links, so a broad SPA rewrite is unnecessary. Missing asset paths should not be rewritten to HTML.

After release checks pass and the owner explicitly authorizes publishing, import the repository into Vercel, choose the project/team and root directory, confirm the settings above, and deploy. Creating a Vercel project from a repository can immediately publish it; treat that as the publishing action. No deployment has been performed by these local scripts. Vercel ownership, platform access, and any custom domain belong to the deploying owner; visitors do not sign in to TypeDash.

Verify the returned deployment URL and the following on that deployment:

1. Fresh visit, complete time and word tests, retry, keyboard navigation, preferences after reload, and History.
2. Font and lazy panels load from the same origin with no console errors. No app account or login controls appear.
3. Inspect response headers with `curl -I https://YOUR_DOMAIN/`, `/index.html`, and a real hashed `/assets/…` path taken from the deployed HTML. HTML must revalidate; hashed assets must have a one-year immutable cache policy. The local HTTP smoke checks file serving, not Vercel’s CDN behavior.
4. A later deployment supplies updated HTML and its matching hashes. If a stale tab cannot fetch an old lazy chunk, the fallback leaves its current view usable; reload obtains the new build. No service worker is installed.

Cache rules follow [Vercel’s Cache-Control guidance](https://vercel.com/kb/guide/how-to-configure-the-cache-control-response-header-in-vercel-projects). A successful local artifact check does not replace live header inspection.

**Device and rollback checks**

On actual iOS Safari and Android Chrome, complete a short test with the software keyboard: check `beforeinput`, composition, backspace, keyboard resize, focus recovery, and orientation change. Check Settings and chart inspection using touch, text zoom, and system reduced motion. A 360 px desktop viewport does not certify a phone keyboard.

If a release regresses, use Vercel’s deployment history to restore the previously accepted deployment and verify it at the production URL. Keep the older deployment available while validating the new one. This release reads preference schemas 1–2 and progress schema 1; rolling back to pre-Phase-5 code makes version-2 preferences read-only for that visit, preserving them. Do not clear browser data to work around a rollout issue. Local progress is tied to the browser and origin: a preview hostname, production hostname, and custom domain each have separate history. No cloud transfer or account sync exists.
