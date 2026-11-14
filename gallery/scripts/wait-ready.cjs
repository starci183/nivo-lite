// Shared helper for every gallery shot script: never photograph a loading or error state.
//
//   const { waitReady, shoot } = require('./wait-ready.cjs')
//   await shoot(page, 'gallery/pages/agent-work/sales-work/1440.png')      // waits, then screenshots
//   await waitReady(page, { timeout: 20000 })                              // or wait only
//
// A page is READY when, for `stable` ms in a row (default 600):
//   - the network has been idle (no in-flight request for `quiet` ms), and
//   - no element matches a busy marker:
//       [aria-busy="true"]                     Grammar sets it on every loading region
//       [data-loading="true"]                  Grammar writes data-loading="false" once loaded, so only "true" counts
//       [data-grammar-skeleton]                Grammar Skeleton / SkeletonGroup nodes (value "true")
//       [data-grammar-loading-region]          Grammar loading region wrapper
//       [class*="starci-core-"][class*="skeleton"]   skeleton parts (list rows, meters, breadcrumbs, field skeletons, ...)
//       [role="progressbar"], [class*="spinner"]     spinners
//   - and the page is not a FATAL error page (refused immediately, never waited on): the Next.js error overlay (`nextjs-portal` shadow
//     dialog, `[data-nextjs-dialog]`, "Build Error" / "Unhandled Runtime Error" / "Failed to compile" / "Can't resolve"), the 500 page
//     (`__NEXT_DATA__` statusCode 500 or page "/_error", "Internal Server Error", "Application error: ..."), or an app with nothing
//     rendered (empty body / empty <main>). The dev "N / Issues" badge alone is not fatal.
//   - and no "error notice" marker is present: [data-grammar-error], [role="alert"] containing the soft retry notice
//     (an error state is not a screen either). Disable with { allowError: true } only for a screen that IS an error design.
// EXPECT-LOADING MODE (the one exception): a shot whose folder name ends `-dang-tai` is the approved loading design of a screen (owner law
// "page loading own shape": loading mirrors the page). `shoot` detects it from the file path (or `{ expectLoading: true }`) and inverts the
// busy check: the page is READY when a skeleton marker IS visible for `stable` ms in a row, and it is refused when no skeleton ever shows,
// when a fatal page or an error notice shows, or when the page already settled into real content. The network is not awaited.
// If it never settles inside `timeout` (default 20000 ms) it throws ShotRefusedError; `shoot` does not write the file, and a CLI
// script should `process.exit(1)` (use `refuseAndExit(err)` below).
//
// Skeleton attribute names verified in @starci/grammar 0.37.5 dist (common/*.css, core/**/index.js).

const BUSY_SELECTORS = [
  '[aria-busy="true"]',
  '[data-loading="true"]',
  '[data-grammar-skeleton]:not([data-grammar-skeleton="false"])',
  '[data-grammar-loading-region]:not([data-grammar-loading-region="false"])',
  '[class*="starci-core-"][class*="skeleton"]',
  '[role="progressbar"]',
  '[class*="spinner"]',
]
const ERROR_SELECTORS = ['[data-grammar-error]', '[data-grammar-retry]']

class ShotRefusedError extends Error {
  constructor(message, detail) {
    super(message)
    this.name = 'ShotRefusedError'
    this.detail = detail
  }
}

// Fatal pages are refused at once (no point waiting): they are never a screen. Checked inside the page.
const FATAL_TEXT = /Build Error|Unhandled Runtime Error|Failed to compile|Can't resolve|Module not found|Internal Server Error|Application error: a (client|server)-side exception|Runtime Error/
const fatalProbe = () => {
  const out = []
  const portals = [...document.querySelectorAll('nextjs-portal')]
  for (const p of portals) {
    // the dev "N / Issues" badge also lives in nextjs-portal: only the dialog or an error text in it is fatal
    const root = p.shadowRoot
    const dialog = (root && root.querySelector('[data-nextjs-dialog], [data-nextjs-dialog-overlay], [data-nextjs-error-overlay]')) || null
    const text = root ? root.textContent || '' : ''
    if (dialog) out.push('nextjs error dialog')
    else if (/Build Error|Unhandled Runtime Error|Failed to compile|Runtime Error/.test(text)) out.push('nextjs error text in portal')
  }
  if (document.querySelector('[data-nextjs-dialog], [data-nextjs-dialog-overlay]')) out.push('nextjs error dialog (light DOM)')
  const nd = document.getElementById('__NEXT_DATA__')
  if (nd) {
    const raw = nd.textContent || ''
    if (/"statusCode"\s*:\s*500/.test(raw) || /"page"\s*:\s*"\/_error"/.test(raw)) out.push('__NEXT_DATA__ says 500 / _error page')
  }
  const body = document.body
  const text = (body && body.innerText) || ''
  if (/Internal Server Error|Application error: a (client|server)-side exception/.test(text)) out.push('500 error text on page')
  if (/Build Error|Failed to compile|Module not found|Can't resolve/.test(text) && text.length < 4000) out.push('build error text on page')
  const media = body ? body.querySelector('img, svg, canvas, video, iframe, input, textarea') : null
  const main = document.querySelector('main, [role="main"]')
  if (!text.trim() && !media) out.push('empty body: nothing rendered')
  else if (main && !(main.innerText || '').trim() && !main.querySelector('img, svg, canvas, video, iframe, input, textarea')) out.push('empty <main>: nothing rendered')
  return out
}

const probe = (page, allowError) =>
  page.evaluate(
    ({ busy, errors, allowError, fatalSrc }) => {
      const fatal = new Function(`return (${fatalSrc})()`)()
      const visible = (el) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return (r.width > 0 || r.height > 0) && s.visibility !== 'hidden' && s.display !== 'none'
      }
      const hit = (sels) => sels.flatMap((s) => [...document.querySelectorAll(s)].filter(visible).map((el) => `${s} <${el.tagName.toLowerCase()}>`))
      return { busy: hit(busy), error: allowError ? [] : hit(errors), fatal: allowError ? [] : fatal, ready: document.readyState === 'complete' }
    },
    { busy: BUSY_SELECTORS, errors: ERROR_SELECTORS, allowError: !!allowError, fatalSrc: fatalProbe.toString() },
  )

async function waitReady(page, opts = {}) {
  const { timeout = 20000, stable = 600, quiet = 500, allowError = false } = opts
  const started = Date.now()
  let inflight = 0
  let lastNet = Date.now()
  const onReq = () => { inflight++; lastNet = Date.now() }
  const onDone = () => { inflight = Math.max(0, inflight - 1); lastNet = Date.now() }
  page.on('request', onReq)
  page.on('requestfinished', onDone)
  page.on('requestfailed', onDone)
  let okSince = 0
  let last = { busy: [], error: [], fatal: [], ready: false }
  try {
    await page.waitForLoadState('load', { timeout }).catch(() => {})
    while (Date.now() - started < timeout) {
      last = await probe(page, allowError)
      if (last.fatal.length) throw new ShotRefusedError(`error page, not a screen: ${last.fatal.join('; ')} (${page.url()})`, { fatal: last.fatal })
      const netIdle = inflight === 0 && Date.now() - lastNet >= quiet
      const clean = last.ready && netIdle && !last.busy.length && !last.error.length
      if (clean) {
        okSince ||= Date.now()
        if (Date.now() - okSince >= stable) return { waitedMs: Date.now() - started }
      } else okSince = 0
      await page.waitForTimeout(100)
    }
  } finally {
    page.off('request', onReq)
    page.off('requestfinished', onDone)
    page.off('requestfailed', onDone)
  }
  throw new ShotRefusedError(`page never settled in ${timeout} ms (${page.url()})`, { inflight, busy: last.busy.slice(0, 8), error: last.error.slice(0, 8) })
}

// The loading folders: `<screen>-dang-tai` (the folder of the file, never the file name).
const LOADING_FOLDER = /-dang-tai$/
const isLoadingFile = (file) => LOADING_FOLDER.test(require('path').basename(require('path').dirname(file)))

async function waitLoading(page, opts = {}) {
  const { timeout = 20000, stable = 300 } = opts
  const started = Date.now()
  let okSince = 0
  let last = { busy: [], error: [], fatal: [], ready: false }
  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {})
  while (Date.now() - started < timeout) {
    last = await probe(page, false)
    if (last.fatal.length) throw new ShotRefusedError(`error page, not a screen: ${last.fatal.join('; ')} (${page.url()})`, { fatal: last.fatal })
    if (last.error.length) throw new ShotRefusedError(`error notice, not a loading screen (${page.url()})`, { error: last.error.slice(0, 8) })
    if (last.busy.length) {
      okSince ||= Date.now()
      if (Date.now() - okSince >= stable) return { waitedMs: Date.now() - started, skeletons: last.busy.length }
    } else okSince = 0
    await page.waitForTimeout(50)
  }
  throw new ShotRefusedError(`expected a loading screen but no skeleton showed in ${timeout} ms (${page.url()})`, { busy: [], error: last.error.slice(0, 8) })
}

async function shoot(page, file, opts = {}) {
  const { screenshot = {}, expectLoading = isLoadingFile(file), ...wait } = opts
  if (expectLoading) await waitLoading(page, wait)
  else await waitReady(page, wait)
  const fs = require('fs')
  fs.mkdirSync(require('path').dirname(file), { recursive: true })
  await page.screenshot({ path: file, ...screenshot })
  return file
}

function refuseAndExit(err) {
  if (err instanceof ShotRefusedError) {
    console.error(`SHOT REFUSED: ${err.message}\n${JSON.stringify(err.detail, null, 2)}`)
    process.exit(1)
  }
  throw err
}

module.exports = { waitReady, waitLoading, isLoadingFile, shoot, refuseAndExit, ShotRefusedError, BUSY_SELECTORS, ERROR_SELECTORS }

// self-test: node wait-ready.cjs --selftest
if (require.main === module && process.argv.includes('--selftest')) {
  const { chromium } = require('playwright')
  ;(async () => {
    const browser = await chromium.launch()
    const page = await browser.newPage()
    await page.setContent('<div data-loading="false">ok</div><p>ready</p>')
    await waitReady(page, { timeout: 3000 })
    console.log('ready page: accepted')
    await page.setContent('<div data-grammar-skeleton="true" style="width:10px;height:10px"></div>')
    let refused = false
    try { await waitReady(page, { timeout: 1500 }) } catch (e) { refused = e instanceof ShotRefusedError }
    console.log('skeleton page: ' + (refused ? 'refused' : 'WRONGLY ACCEPTED'))
    await page.setContent('<div aria-busy="true" style="width:10px;height:10px">x</div>')
    refused = false
    try { await waitReady(page, { timeout: 1500 }) } catch (e) { refused = e instanceof ShotRefusedError }
    console.log('aria-busy page: ' + (refused ? 'refused' : 'WRONGLY ACCEPTED'))
    const bad = {
      'next overlay (shadow dialog)': () => { const p = document.createElement('nextjs-portal'); p.attachShadow({ mode: 'open' }).innerHTML = '<div data-nextjs-dialog><p>Build Error</p></div>'; document.body.append(p, Object.assign(document.createElement('p'), { textContent: 'x' })) },
      'next overlay text only': () => { const p = document.createElement('nextjs-portal'); p.attachShadow({ mode: 'open' }).innerHTML = '<div>Failed to compile: module not found</div>'; document.body.append(p, Object.assign(document.createElement('p'), { textContent: 'x' })) },
      "500 __NEXT_DATA__": () => { const s = document.createElement("script"); s.id = "__NEXT_DATA__"; s.type = "application/json"; s.textContent = JSON.stringify({ page: "/_error", props: { statusCode: 500 } }); document.body.innerHTML = "<p>x</p>"; document.body.append(s) },
      '500 text': () => { document.body.innerHTML = '<h1>Internal Server Error</h1>' },
      'empty body': () => { document.body.innerHTML = '' },
      'empty main': () => { document.body.innerHTML = '<nav>menu</nav><main> </main>' },
    }
    let allOk = refused
    for (const [name, build] of Object.entries(bad)) {
      await page.setContent('<html><body></body></html>')
      await page.evaluate(build)
      let r = false
      try { await waitReady(page, { timeout: 1500 }) } catch (e) { r = e instanceof ShotRefusedError }
      console.log(name + ': ' + (r ? 'refused' : 'WRONGLY ACCEPTED'))
      allOk = allOk && r
    }
    await page.setContent('<html><body><nextjs-portal></nextjs-portal><main><p>real content</p></main></body></html>')
    await page.evaluate(() => document.querySelector('nextjs-portal').attachShadow({ mode: 'open' }).innerHTML = '<div>1 Issue</div>')
    await waitReady(page, { timeout: 3000 })
    console.log('dev Issues badge only + content: accepted')
    // expect-loading mode: a skeleton IS the screen; real content or an error is refused
    await page.setContent('<h1>Chat</h1><div data-grammar-skeleton="true" style="width:10px;height:10px"></div>')
    await waitLoading(page, { timeout: 3000 })
    console.log('expect loading, skeleton page: accepted')
    await page.setContent('<div data-loading="false">ok</div><p>ready</p>')
    let loadingRefused = false
    try { await waitLoading(page, { timeout: 1200 }) } catch (e) { loadingRefused = e instanceof ShotRefusedError }
    console.log('expect loading, settled page: ' + (loadingRefused ? 'refused' : 'WRONGLY ACCEPTED'))
    await page.setContent('<html><body><h1>Internal Server Error</h1><div data-grammar-skeleton="true" style="width:10px;height:10px"></div></body></html>')
    let loadingFatal = false
    try { await waitLoading(page, { timeout: 1200 }) } catch (e) { loadingFatal = e instanceof ShotRefusedError }
    console.log('expect loading, 500 page: ' + (loadingFatal ? 'refused' : 'WRONGLY ACCEPTED'))
    console.log('folder detection: ' + (isLoadingFile('gallery/pages/a/sales-dang-tai/1440.png') && !isLoadingFile('gallery/pages/a/sales/1440.png') ? 'ok' : 'WRONG'))
    allOk = allOk && loadingRefused && loadingFatal
    await browser.close()
    process.exit(allOk ? 0 : 1)
  })()
}
