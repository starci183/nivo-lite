// Own login + saved storage state for the audit. Credentials come from the sealed secret files the dev stack wrote
// (`starci app secret get --to-file`); they are read into memory, typed into the login form and never printed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

export const HERE = path.dirname(fileURLToPath(import.meta.url))
export const STATE = path.join(HERE, '.auth', 'state.json')
export const META = path.join(HERE, '.auth', 'meta.json')
export const BASE = (process.env.BASE_URL || 'http://localhost:3900').replace(/\/$/, '')
const SECRET = process.env.NIVO_SECRET_DIR || 'C:/Users/Hi/AppData/Local/StarCi/secrets/nivo-lite/dev/'

const require = createRequire(import.meta.url)
export const loadPlaywright = () => {
  for (const id of ['playwright', process.env.PLAYWRIGHT_PATH || 'D:/.claude/packages/grammar/node_modules/playwright']) {
    try { return require(id) } catch { /* try the next */ }
  }
  throw new Error('playwright not found: npm i -D playwright in gallery, or set PLAYWRIGHT_PATH')
}

// The dev web is built against http://localhost:3999; every browser request to it is forwarded to the dev API on :18787.
export const attachApiProxy = async (ctx) => {
  const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
  await ctx.route('http://localhost:3999/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const headers = { ...req.headers(), origin: 'http://localhost:3000' }
    delete headers.host
    try {
      const resp = await route.fetch({ url: req.url().replace('http://localhost:3999', 'http://127.0.0.1:18787'), headers })
      const out = { ...resp.headers() }
      for (const k of Object.keys(out)) if (k.startsWith('access-control-')) delete out[k]
      return route.fulfill({ response: resp, headers: { ...out, ...cors } })
    } catch { return route.fulfill({ status: 502, headers: cors, body: '' }) }
  })
}

export const newContext = async (browser, width, withState = true) => {
  const ctx = await browser.newContext({
    viewport: { width, height: width > 500 ? 1000 : 844 }, locale: 'vi-VN',
    ...(withState && fs.existsSync(STATE) ? { storageState: STATE } : {}),
  })
  await ctx.addCookies([{ name: 'NIVO_LOCALE', value: 'vi', url: BASE }])
  await attachApiProxy(ctx)
  return ctx
}

/** Logs in once and saves the state + the workspace id. Returns the workspace id. */
export const login = async (browser) => {
  const email = fs.readFileSync(SECRET + 'NIVO_OWNER_EMAIL', 'utf8').trim()
  const password = fs.readFileSync(SECRET + 'NIVO_OWNER_PASSWORD', 'utf8').trim()
  const ctx = await newContext(browser, 1440, false)
  const p = await ctx.newPage()
  await p.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 300000 })
  await p.waitForTimeout(6000)
  await p.getByLabel('Email').fill(email)
  await p.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await p.getByRole('button', { name: /Đăng nhập/ }).first().click()
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 }).catch(() => undefined)
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(2000)
  let ws = (/\/workspaces\/([0-9a-f-]{36})/.exec(p.url()) || [])[1]
  if (!ws) {
    await p.goto(BASE + '/workspaces', { waitUntil: 'networkidle', timeout: 300000 }); await p.waitForTimeout(2000)
    await p.getByRole('button', { name: 'Mở' }).first().click()
    await p.waitForURL(/\/workspaces\/[0-9a-f-]{36}/, { timeout: 120000 }).catch(() => undefined)
    ws = (/\/workspaces\/([0-9a-f-]{36})/.exec(p.url()) || [])[1]
  }
  if (!ws) throw new Error('login did not reach a workspace')
  fs.mkdirSync(path.dirname(STATE), { recursive: true })
  await ctx.storageState({ path: STATE })
  fs.writeFileSync(META, JSON.stringify({ workspace: ws, savedAt: new Date().toISOString() }))
  await ctx.close()
  return ws
}

/** Persists the (possibly rotated) refresh cookie so the next context starts from the newest state. */
export const persist = async (ctx) => { try { await ctx.storageState({ path: STATE }) } catch { /* keep the old state */ } }
export const workspaceId = () => (fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')).workspace : null)

/** A context on the saved state that is verified to be signed in; logs in again once when the state is stale. */
export const openSession = async (browser, width) => {
  let ws = workspaceId()
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!ws || !fs.existsSync(STATE)) ws = await login(browser)
    const ctx = await newContext(browser, width)
    const p = await ctx.newPage()
    await p.goto(`${BASE}/workspaces/${ws}/overview`, { waitUntil: 'load', timeout: 300000 }).catch(() => undefined)
    await p.waitForTimeout(2500)
    if (!/\/login|\/signup/.test(p.url())) { await persist(ctx); await p.close(); return { ctx, ws } }
    await ctx.close(); ws = null
    if (attempt === 0) await new Promise((r) => setTimeout(r, 61000)) // the login limit is 30 per minute per IP
  }
  throw new Error('cannot sign in')
}
