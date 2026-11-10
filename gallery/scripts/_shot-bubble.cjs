// Shoots shell/khung-chung (bubble hidden), shell/khung-chung-tro-ly (avatar menu open, toggle on, bubble shown),
// agents-catalog/dang-chay and dang-chay-menu at 1440/1920/390. usage: node _shot-bubble.cjs [probe]
const { chromium } = require('D:/starci-lanes/nivo-auth-ux/gallery/node_modules/playwright')
const fs = require('fs')
const { shoot, refuseAndExit } = require('./wait-ready.cjs')
const BASE = 'http://localhost:3900'
const SECRET = 'C:/Users/Hi/AppData/Local/StarCi/secrets/nivo-lite/dev/'
const email = fs.readFileSync(SECRET + 'NIVO_OWNER_EMAIL', 'utf8').trim()
const password = fs.readFileSync(SECRET + 'NIVO_OWNER_PASSWORD', 'utf8').trim()
const ROOT = 'D:/starci-lanes/nivo-auth-ux/gallery/pages/'
const SIZES = [[1440, 1000], [1920, 1080], [390, 844]]
const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN' })
  await ctx.addCookies([{ name: 'NIVO_LOCALE', value: 'vi', url: BASE }])
  const p = await ctx.newPage()
  try {
    await p.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 300000 }); await p.waitForTimeout(5000)
    await p.getByLabel('Email').fill(email); await p.getByLabel('Mật khẩu', { exact: true }).fill(password)
    await p.getByRole('button', { name: /Đăng nhập/ }).first().click()
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 }).catch(() => undefined)
    await p.waitForLoadState('networkidle'); await p.waitForTimeout(3000)
    if (!/\/workspaces\//.test(p.url())) { await p.getByRole('link', { name: 'Mở', exact: true }).first().click().catch(async () => { await p.getByRole('button', { name: 'Mở', exact: true }).first().click() }); await p.waitForURL(/\/workspaces\//, { timeout: 60000 }); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2000) }
    const ws = (p.url().match(/\/workspaces\/([^/]+)/) || [])[1]
    console.log('ws', ws, p.url())
    await p.goto(`${BASE}/workspaces/${ws}/agents`, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000)
    const hrefs = await p.$$eval('a[href*="/agents/"]', (as) => as.map((a) => a.getAttribute('href')))
    console.log(hrefs.slice(0, 12))
    if (process.argv[2] === 'probe') { await b.close(); return }
    const sales = hrefs.find((h) => /\/agents\/sales\//.test(h))
    const rules = sales && sales.replace(/\/?(\?.*)?$/, '') // refined below
    // the shared-frame sample: Sales > Bàn làm việc > Quy tắc
    const framePath = process.env.FRAME_PATH
    const frameUrl = BASE + (framePath || sales)
    const clearBubble = () => p.evaluate(() => { try { localStorage.removeItem('NIVO_GUIDE_BUBBLE_SHOWN') } catch {} })
    const setBubble = () => p.evaluate(() => { try { localStorage.setItem('NIVO_GUIDE_BUBBLE_SHOWN', 'true') } catch {} })
    const visit = async (url) => { await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500) }
    for (const [w, h] of SIZES) {
      await p.setViewportSize({ width: w, height: h })
      // 1. khung-chung, hidden
      await clearBubble(); await visit(frameUrl)
      if (process.env.FRAME_TAB) { await p.getByRole('tab', { name: process.env.FRAME_TAB }).first().click().catch(() => {}); await p.waitForTimeout(2000) }
      await shoot(p, `${ROOT}shell/khung-chung/${w}.png`)
      if (process.env.TROLY === '1') {
      // 2. khung-chung-tro-ly: toggle on through the menu, then menu open
      await visit(frameUrl)
      if (process.env.FRAME_TAB) { await p.getByRole('tab', { name: process.env.FRAME_TAB }).first().click().catch(() => {}); await p.waitForTimeout(2000) }
      const pos = await p.evaluate(() => { const bs = [...document.querySelectorAll('button[aria-haspopup]')].map((e) => e.getBoundingClientRect()).filter((r) => r.top < 70 && r.width > 0).sort((a, b) => b.right - a.right); return bs[0] ? { x: bs[0].left + bs[0].width / 2, y: bs[0].top + bs[0].height / 2 } : null })
      if (!pos) throw new Error('no avatar')
      const avatar = { click: () => p.mouse.click(pos.x, pos.y) }
      await avatar.click(); await p.waitForTimeout(600)
      if (process.env.DBG) console.log(await p.evaluate(() => [...document.querySelectorAll('[role^=menu]')].map((e) => e.getAttribute('role') + ':' + e.innerText.slice(0, 40))))
      await p.getByRole('menuitemcheckbox', { name: /Hiện trợ lý NIVO/ }).click(); await p.waitForTimeout(800)
      if (!(await p.getByRole('menuitemcheckbox', { name: /Hiện trợ lý NIVO/ }).isVisible().catch(() => false))) { await avatar.click(); await p.waitForTimeout(600) }
      await shoot(p, `${ROOT}shell/khung-chung-tro-ly/${w}.png`)
      await p.keyboard.press('Escape')
      }
      if (process.env.TROLY !== '1') {
      // 3. agents-catalog, bubble hidden
      await clearBubble(); await visit(`${BASE}/workspaces/${ws}/agents`)
      await shoot(p, `${ROOT}agents-catalog/dang-chay/${w}.png`)
      // 4. menu of the first card
      const more = p.getByRole('button', { name: /Tuỳ chọn của/ }).first()
      await more.click(); await p.waitForTimeout(800)
      await p.mouse.move(0, 0)
      await shoot(p, `${ROOT}agents-catalog/dang-chay-menu/${w}.png`)
      await p.keyboard.press('Escape')
      }
      console.log('done', w)
    }
    await clearBubble()
  } catch (e) { await b.close(); refuseAndExit(e); console.error(e); process.exit(1) }
  await b.close()
})()
