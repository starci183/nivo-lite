// NIVO UI law-audit. usage: npm run audit   (env: BASE_URL, FILTER=comma list of page-name substrings, WIDTHS=1440,390, CONCURRENCY=3)
import fs from 'node:fs'
import path from 'node:path'
import { loadPlaywright, openSession, persist, BASE, HERE } from './auth.mjs'
import { probe } from './probes.mjs'

const ROOT = path.resolve(HERE, '..', '..')
const SHOTS = path.join(ROOT, 'gallery', 'shots', 'audit')
const REPORT = path.join(HERE, 'report.json')
const WIDTHS = (process.env.WIDTHS || '1440,390').split(',').map(Number)
const FILTER = (process.env.FILTER || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
const CONC = Number(process.env.CONCURRENCY || 3)
const RULES = ['font-size', 'filled-icon', 'well-border+shadow', 'card-in-card', 'description-under-label', 'tab-count-text', 'band-gap', 'hidden-under-band', 'band-scrolls', 'aside-not-flush', 'raw-key', 'typed-arrow', 'scrollbar', 'overflow-x', 'btn-sm-icon', 'btn-sm-icon-only', 'multi-primary']

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[?&=/\s]+/g, '-').replace(/[^a-zA-Z0-9~-]+/g, '').replace(/^-+|-+$/g, '').toLowerCase()
const matches = (name) => FILTER.length === 0 || FILTER.some((f) => name.toLowerCase().includes(f))

// Known agent installations (module/id); replaced by what the catalog shows when it shows any.
const AGENTS = [
  ['accounting', '1d24b4e0-d276-4ecb-a0e9-07bd01395630'],
  ['chatbot', '1ea3eaee-ace5-46d1-a45d-c892a75252b6'],
  ['sales', '12732e05-8cf1-44da-969b-cf289b2b85fa'],
]
const WORKSPACE_PAGES = ['overview', 'inbox', 'chat', 'team', 'permissions', 'authority', 'billing', 'billing/plan', 'brain', 'account', 'profile', 'developers', 'knowledge', 'knowledge/nivo', 'connections', 'connections/google', 'connections/drive', 'connections/sepay', 'connections/telegram', 'connections/zalo', 'agents', 'agents/marketplace', 'agents/templates', 'agents/accounting', 'agents/chatbot', 'agents/sales']
const AGENT_TABS = ['workbench', 'work', 'work?view=runs', 'chat', 'connections', 'knowledge', 'performance', 'settings', 'setup', 'setup/general', 'setup/workflows']

const { chromium } = loadPlaywright()
// Keep the real scrollbars (Playwright hides them by default) so "no visible scrollbar" can be measured.
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
const { ctx, ws } = await openSession(browser, 1440)

const results = []
const queued = new Set()
const queue = []
const enqueue = (rel, name) => {
  const key = rel
  if (queued.has(key)) return
  queued.add(key)
  queue.push({ rel, name: name || slug(rel) })
}
for (const p of WORKSPACE_PAGES) enqueue(p)
for (const [m, id] of AGENTS) for (const t of AGENT_TABS) enqueue(`agents/${m}/${id}/${t}`, `agent-${m}-${slug(t)}`)

const wsUrl = (rel) => `${BASE}/workspaces/${ws}/${rel}`
const relOf = (href) => {
  try {
    const u = new URL(href, BASE)
    const m = new RegExp(`^/workspaces/${ws}/(.+)$`).exec(u.pathname)
    return m ? m[1] + u.search : null
  } catch { return null }
}
const agentName = (rel) => {
  const m = /^agents\/([^/]+)\/[0-9a-f-]{36}(?:\/(.*))?$/.exec(rel)
  return m ? `agent-${m[1]}-${slug(m[2] || 'landing')}` : slug(rel)
}

const settle = async (p) => {
  await p.waitForLoadState('load', { timeout: 120000 }).catch(() => undefined)
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
  await p.waitForTimeout(2200)
}

// one audit of whatever the page shows now
const auditNow = async (p, name, w, rel, extra = {}) => {
  const rec = { page: name, path: rel, width: w, url: p.url(), findings: [], ...extra }
  if (/\/login|\/signup/.test(p.url()) && !/login|signup/.test(rel)) { rec.error = 'redirected to login (state expired)'; results.push(rec); return rec }
  const vh0 = w > 500 ? 1000 : 844
  await p.setViewportSize({ width: w, height: vh0 })
  await p.waitForTimeout(250)
  const bodyText = await p.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '')
  if (/This page could not be found|404/.test(bodyText) && bodyText.length < 120) rec.error = '404'
  const a = await p.evaluate(probe, { pass: 'view' })
  const tall = Math.min(6000, vh0 + Math.ceil(a.meta.extra || 0) + 40)
  if (tall > vh0 + 20) { await p.setViewportSize({ width: w, height: tall }); await p.waitForTimeout(800) }
  const b = await p.evaluate(probe, { pass: 'content' })
  rec.findings = [...a.findings, ...b.findings]
  // outline the findings in red and shoot
  await p.evaluate((list) => {
    const wrap = document.createElement('div')
    wrap.setAttribute('data-audit-overlay', '1')
    wrap.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none'
    for (const f of list) {
      const el = document.querySelector(`[data-audit-id~="${f.id}"]`)
      const r = el ? el.getBoundingClientRect() : null
      const x = r && (r.width || r.height) ? r.left + scrollX : f.box.x
      const y = r && (r.width || r.height) ? r.top + scrollY : f.box.y
      const bw = r && (r.width || r.height) ? r.width : f.box.w
      const bh = r && (r.width || r.height) ? r.height : f.box.h
      const d = document.createElement('div')
      d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${Math.max(bw, 4)}px;height:${Math.max(bh, 4)}px;outline:2px solid red;outline-offset:1px`
      const l = document.createElement('span')
      l.textContent = f.rule
      l.style.cssText = 'position:absolute;left:0;top:-13px;background:red;color:#fff;font:10px/12px monospace;padding:0 3px;white-space:nowrap'
      d.appendChild(l)
      wrap.appendChild(d)
    }
    document.body.appendChild(wrap)
  }, rec.findings).catch(() => undefined)
  fs.mkdirSync(SHOTS, { recursive: true })
  rec.shot = path.relative(ROOT, path.join(SHOTS, `${name}__${w}__audit.png`)).replace(/\\/g, '/')
  await p.screenshot({ path: path.join(ROOT, rec.shot), fullPage: true }).catch(() => { rec.shotError = true })
  await p.evaluate(() => document.querySelectorAll('[data-audit-overlay]').forEach((n) => n.remove())).catch(() => undefined)
  for (const f of rec.findings) delete f.id
  results.push(rec)
  console.log(`${String(rec.findings.length).padStart(4)}  ${name} @${w}${rec.error ? '  [' + rec.error + ']' : ''}`)
  return rec
}

const runJob = async (p, job, w) => {
  const name = job.name.startsWith('agent-') || !/^agents\/[^/]+\/[0-9a-f-]{36}/.test(job.rel) ? job.name : agentName(job.rel)
  if (!matches(name) && !job.sub) return
  await p.setViewportSize({ width: w, height: w > 500 ? 1000 : 844 })
  await p.goto(wsUrl(job.rel), { waitUntil: 'commit', timeout: 180000 }).catch(() => undefined)
  await settle(p)
  const rec = await auditNow(p, name, w, job.rel)
  if (rec.error) return
  // discover the header tabs: links become pages of their own, buttons are clicked and audited
  if (w !== WIDTHS[0]) return
  const tabs = await p.evaluate(() => Array.prototype.slice.call(document.querySelectorAll('.starci-core-page-header [role=tab]')).map((t, i) => ({ i, href: t.getAttribute('href'), label: (t.textContent || '').trim(), selected: t.getAttribute('aria-selected') === 'true' })))
  for (const t of tabs) {
    if (t.href) {
      const rel = relOf(t.href)
      if (rel && !queued.has(rel)) {
        const base = /^agents\/([^/]+)\/[0-9a-f-]{36}/.exec(rel)
        if (base || /^(brain|knowledge|billing|authority|connections|team|permissions)/.test(rel)) enqueue(rel, agentName(rel))
      }
    }
  }
  const clicks = tabs.filter((t) => !t.href && !t.selected)
  for (const t of clicks) {
    const sub = `${name}~${slug(t.label) || 'tab' + t.i}`
    if (!matches(sub) && !matches(name)) continue
    await p.goto(wsUrl(job.rel), { waitUntil: 'commit', timeout: 180000 }).catch(() => undefined)
    await settle(p)
    const tab = p.locator('.starci-core-page-header [role=tab]').nth(t.i)
    if (!(await tab.count())) continue
    await tab.click({ timeout: 5000 }).catch(() => undefined)
    await p.waitForTimeout(1500)
    await auditNow(p, sub, w, job.rel, { clicked: t.label })
  }
}

// Run each width over a fresh queue (discovered pages from the first width are kept for the next).
const runWidth = async (w) => {
  const jobs = queue.map((j) => ({ ...j }))
  let cursor = 0
  const workers = []
  for (let k = 0; k < CONC; k++) {
    workers.push((async () => {
      const p = await ctx.newPage()
      while (true) {
        // for the first width the queue grows while it is consumed
        const job = w === WIDTHS[0] ? queue[cursor++] : jobs[cursor++]
        if (!job) break
        try { await runJob(p, job, w) } catch (e) { results.push({ page: job.name, path: job.rel, width: w, findings: [], error: String(e.message).slice(0, 120) }); console.log('ERR', job.name, w, String(e.message).slice(0, 100)) }
        if (cursor % 10 === 0) await persist(ctx)
      }
      await p.close()
    })())
  }
  await Promise.all(workers)
  await persist(ctx)
}

// Agents: prefer the installations the catalog really lists.
{
  const p = await ctx.newPage()
  await p.goto(wsUrl('agents'), { waitUntil: 'commit', timeout: 180000 }).catch(() => undefined)
  await settle(p)
  const hrefs = await p.evaluate(() => Array.prototype.slice.call(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')))
  await p.close()
  const found = new Set()
  for (const h of hrefs) {
    const m = /\/agents\/([^/]+)\/([0-9a-f-]{36})/.exec(h || '')
    if (m && !AGENTS.some((a) => a[1] === m[2]) && !found.has(m[2])) {
      found.add(m[2])
      for (const t of AGENT_TABS) enqueue(`agents/${m[1]}/${m[2]}/${t}`, `agent-${m[1]}-${slug(t)}-${m[2].slice(0, 4)}`)
    }
  }
}

for (const w of WIDTHS) { console.log(`--- width ${w}`); await runWidth(w) }
await browser.close()

// ───────── report ─────────
const by = (fn) => results.reduce((m, r) => { for (const f of r.findings) { const k = fn(r, f); m[k] = (m[k] || 0) + 1 } return m }, {})
const byRule = by((r, f) => f.rule)
const report = { generatedAt: new Date().toISOString(), base: BASE, widths: WIDTHS, rules: RULES, totals: { findings: results.reduce((n, r) => n + r.findings.length, 0), pages: results.length, byRule }, pages: results }
fs.writeFileSync(REPORT, JSON.stringify(report, null, 1))

const pad = (s, n) => String(s).padEnd(n)
console.log('\nBy rule')
for (const [k, v] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
  const pages = new Set(results.filter((r) => r.findings.some((f) => f.rule === k)).map((r) => r.page)).size
  console.log(`  ${pad(k, 26)} ${String(v).padStart(5)} findings on ${pages} pages`)
}
const codes = RULES.filter((r) => byRule[r])
console.log('\nPage x rule (legend: ' + codes.map((c, i) => `${i + 1}=${c}`).join(' ') + ')')
console.log(pad('page @width', 52) + codes.map((_, i) => String(i + 1).padStart(5)).join(''))
for (const r of [...results].sort((a, b) => b.findings.length - a.findings.length)) {
  const cnt = codes.map((c) => r.findings.filter((f) => f.rule === c).length)
  console.log(pad(`${r.page} @${r.width}${r.error ? ' !' : ''}`, 52) + cnt.map((n) => (n ? String(n) : '.').padStart(5)).join(''))
}
console.log(`\nTotal ${report.totals.findings} findings on ${results.length} page-widths. Report: ${path.relative(ROOT, REPORT)}  Shots: ${path.relative(ROOT, SHOTS)}`)
