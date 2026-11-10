const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3900';
const SECRET = 'C:/Users/Hi/AppData/Local/StarCi/secrets/nivo-lite/dev/';
const email = fs.readFileSync(SECRET + 'NIVO_OWNER_EMAIL', 'utf8').trim();
const password = fs.readFileSync(SECRET + 'NIVO_OWNER_PASSWORD', 'utf8').trim();
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN' });
  await ctx.addCookies([{ name: 'NIVO_LOCALE', value: 'vi', url: BASE }]);
  const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
  await ctx.route('http://localhost:3999/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const headers = { ...req.headers(), origin: 'http://localhost:3000' }; delete headers.host;
    try { const resp = await route.fetch({ url: req.url().replace('http://localhost:3999', 'http://127.0.0.1:18787'), headers });
      const out = { ...resp.headers() }; for (const k of Object.keys(out)) if (k.startsWith('access-control-')) delete out[k];
      return route.fulfill({ response: resp, headers: { ...out, ...cors } }); } catch (e) { return route.fulfill({ status: 502, headers: cors, body: '' }); }
  });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 300000 }); await p.waitForTimeout(6000);
  await p.getByLabel('Email').fill(email); await p.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await p.getByRole('button', { name: /Đăng nhập/ }).first().click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 }).catch(() => undefined);
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(3000);
  await p.goto(BASE + '/workspaces', { waitUntil: 'networkidle', timeout: 300000 }); await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Mở' }).first().click(); await p.waitForURL(/\/workspaces\/[^/]+\//, { timeout: 120000 }).catch(() => undefined);
  await p.waitForTimeout(4000);
  await p.getByText('Agent', { exact: true }).first().click(); await p.waitForTimeout(8000);
  await p.evaluate(() => [...document.querySelectorAll('button[data-grammar-row-press]')].find((b) => b.innerText.trim() === 'Sales').click()); await p.waitForTimeout(12000); console.log('SALESURL', p.url());
  await p.waitForTimeout(3000);
  const base = new URL(p.url()).pathname.replace(/\/(workbench).*$/, '');
  await p.evaluate((u) => window.next.router.push(u), base + '/' + process.argv[2]);
  await p.waitForTimeout(25000);
  console.log('AFTER GOTO', p.url());
  for (let i = 0; i < 60; i++) { const n = await p.evaluate(() => document.body.innerText.length).catch(() => 0); if (n > 300) break; await p.waitForTimeout(2000); }
  await p.waitForTimeout(3000);
  if (process.env.CLICK) { await p.getByText(process.env.CLICK, { exact: true }).first().click(); await p.waitForTimeout(15000); console.log('CLICKED', p.url()); }
  const info = await p.evaluate(() => {
    const d = (e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`; };
    const all = [...document.querySelectorAll('main *')].filter((e) => getComputedStyle(e).cursor === 'pointer' && e.getBoundingClientRect().width > 4 && !e.parentElement.closest('[style*="cursor"]') );
    return { url: location.href, ptr: all.slice(0, 60).map((e) => `${e.tagName}${e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : ''}.${String(e.className).slice(0, 40)} ${(e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)} ${d(e)}`) };
  });
  console.log(JSON.stringify(info, null, 1)); await p.screenshot({ path: 'D:/starci-lanes/nivo-auth-ux/gallery/scripts/_p.png' });
  await b.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
