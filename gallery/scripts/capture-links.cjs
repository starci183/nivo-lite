// Extracts, for every reachable page of one agent, each interactive element that navigates, with its box at 1440,
// and where it goes (another page, or an overlay on the same page). Output: gallery/capture/<agent>.json (raw);
// scripts/build-links.mjs maps it onto gallery folders and writes gallery/pages/<area>/<page>/links.json.
//
// usage: node capture-links.cjs <sales|accounting|chatbot> [maxPages]   (app on http://localhost:3900, dev API on :18787)
//
// Safety: signs in with the sealed dev test owner read from the seed files (never printed). After sign-in every mutating request
// (POST/PUT/PATCH/DELETE) to the API is aborted, buttons whose label looks like a mutation are never clicked (listed under `skipped`),
// and submit buttons are never pressed. Navigation is detected from `href`, `data-gallery-to`, or a click that changes the route.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const agent = process.argv[2];
const MAXP = Number(process.argv[3] || 40);
if (!['sales', 'accounting', 'chatbot'].includes(agent)) { console.log('usage: capture-links.cjs <sales|accounting|chatbot> [maxPages]'); process.exit(2); }
const BASE = 'http://localhost:3900';
const SECRET = 'C:/Users/Hi/AppData/Local/StarCi/secrets/nivo-lite/dev/';
const email = fs.readFileSync(SECRET + 'NIVO_OWNER_EMAIL', 'utf8').trim();
const password = fs.readFileSync(SECRET + 'NIVO_OWNER_PASSWORD', 'utf8').trim();
const OUT = path.join(__dirname, '..', 'capture');
const DANGER = /xo[aá]|xoá|xóa|gửi|thanh toán|lưu|đăng xuất|hu[ỷỷy]|hủy|huỷ|duyệt|từ chối|chạy thử|chạy ngay|chạy lại|xuất|bật|tắt|gỡ|ngắt|xác nhận|áp dụng|cập nhật|trả lời|phát hành|xuất bản|thử lại|tiếp quản|bỏ qua|publish|delete|remove|send|save|pay|logout|sign out|disconnect|approve|reject|export|retry|submit|đồng ý|tạo|thêm|mời|nâng cấp|mua|đổi/i;

const key = (u) => {
  const x = new URL(u, BASE);
  let p = x.pathname.replace(/\/+$/, '');
  p = p.replace(/^\/workspaces\/[^/]+/, '/workspaces/<ws>').replace(/^(\/workspaces\/<ws>\/agents\/[^/]+)\/[0-9a-f-]{36}/, '$1/<inst>');
  p = p.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/g, '/<id>');
  const q = ['tab', 'view'].filter((k) => x.searchParams.has(k)).map((k) => `${k}=${x.searchParams.get(k)}`).join('&');
  return p + (q ? '?' + q : '');
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN' });
  await ctx.addCookies([{ name: 'NIVO_LOCALE', value: 'vi', url: BASE }]);
  const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
  let armed = false, blocked = 0; const seenNonGet = new Set();
  await ctx.route('http://localhost:3999/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    // The API is GraphQL over POST: queries must pass (they are the page's data), mutations are aborted.
    const isMutation = () => { if (req.method() === 'GET' || req.method() === 'HEAD') return false; if (/\/auth\/refresh/.test(req.url())) return false; /* keeps the session alive */ if (!/\/graphql/.test(req.url())) return true; const body = req.postData() || ''; return /mutation/i.test(body) || !body; };
    if (armed && isMutation()) { blocked++; seenNonGet.add(req.method() + ' ' + new URL(req.url()).pathname.replace(/[0-9a-f-]{36}/g, ':id')); return route.fulfill({ status: 403, headers: cors, body: '{}' }); }
    const headers = { ...req.headers(), origin: 'http://localhost:3000' }; delete headers.host;
    try {
      const resp = await route.fetch({ url: req.url().replace('http://localhost:3999', 'http://127.0.0.1:18787'), headers });
      const out = { ...resp.headers() }; for (const k of Object.keys(out)) if (k.startsWith('access-control-')) delete out[k];
      return route.fulfill({ response: resp, headers: { ...out, ...cors } });
    } catch (e) { return route.fulfill({ status: 502, headers: cors, body: '' }); }
  });
  const p = await ctx.newPage();
  const ready = async () => {
    for (let i = 0; i < 45; i++) { const n = await p.evaluate(() => document.body.innerText.length).catch(() => 0); if (n > 300) break; await p.waitForTimeout(2000); }
    await p.waitForTimeout(1800);
  };
  await p.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 300000 }); await p.waitForTimeout(6000);
  await p.getByLabel('Email').fill(email); await p.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await p.getByRole('button', { name: /Đăng nhập/ }).first().click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 }).catch(() => undefined);
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(3000);
  await p.goto(BASE + '/workspaces', { waitUntil: 'networkidle', timeout: 300000 }); await p.waitForTimeout(2000);
  for (let t = 0; t < 40; t++) { // the lobby either shows an "Mở" button or sends us straight into the only workspace
    if (/\/workspaces\/[0-9a-f-]{36}/.test(p.url())) break;
    const btn = p.getByRole('button', { name: 'Mở' }).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click(); break; }
    await p.waitForTimeout(3000);
  }
  await p.waitForURL(/\/workspaces\/[0-9a-f-]{36}/, { timeout: 120000 }).catch(() => undefined);
  await p.waitForTimeout(4000);
  const ws = (/\/workspaces\/([^/?]+)/.exec(p.url()) || [])[1];
  // Deep links bounce to the overview on a hard load; the app's own router keeps the session.
  const go = async (u) => {
    await p.evaluate((x) => window.next.router.push(x), u).catch(() => undefined);
    const want = new URL(u, BASE); const wantQ = want.search ? want.searchParams.get('tab') || want.searchParams.get('view') : null;
    for (let i = 0; i < 45; i++) { // the dev server compiles a route on first visit; wait for the address to arrive
      const cur = new URL(p.url());
      if (cur.pathname === want.pathname && (!wantQ || cur.search.includes(wantQ))) break;
      if (i > 3 && cur.pathname !== want.pathname && i % 6 === 0) await p.evaluate((x) => window.next.router.push(x), u).catch(() => undefined);
      await p.waitForTimeout(2000);
    }
    await p.waitForTimeout(1500); await ready(); await p.waitForTimeout(1500);
  };
  await p.getByText('Agent', { exact: true }).first().click(); await p.waitForTimeout(6000); await ready();
  const label = { sales: 'Sales', accounting: 'Kế toán', chatbot: 'Chatbot' }[agent];
  for (let t = 0; t < 20 && !/agents\/[^/]+\/[0-9a-f-]{36}/.test(p.url()); t++) {
    // the agent list is rows (button[data-grammar-row-press]) or cards: find the element showing "@<module>" and press what carries it
    const box = await p.evaluate((h) => {
      const el = [...document.querySelectorAll('main *')].find((e) => e.children.length === 0 && e.textContent.trim() === '@' + h);
      if (!el) return null;
      const tgt = el.closest('button,a,[role=button],[data-grammar-row-press],tr,li') ?? el.parentElement.parentElement;
      tgt.scrollIntoView({ block: 'center' });
      const r = (tgt.querySelector('button,a') ?? tgt).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 3 };
    }, agent);
    if (box) await p.mouse.click(box.x, box.y);
    await p.waitForTimeout(8000);
  }
  await ready();
  const m = /\/workspaces\/[^/]+\/agents\/[^/]+\/[0-9a-f-]{36}/.exec(p.url());
  if (!m) { console.log('STOPPED no installation url', p.url(), (await p.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\s+/g, ' ')); await p.screenshot({ path: __dirname + '/_fail.png' }); process.exit(1); }
  const BASEA = m[0];
  armed = true;
  console.log('installation', BASEA.replace(ws, '<ws>'));

  const extract = () => p.evaluate((danger) => {
    const re = new RegExp(danger, 'i');
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const chrome = (e) => !!e.closest('header') || (!!e.closest('nav') && e.closest('nav').getBoundingClientRect().x < 4 && e.closest('nav').getBoundingClientRect().width < 300);
    const sel = 'a[href],[data-gallery-to],button,[role=tab],[role=button],[role=menuitem],tr[role=row],[role=row][tabindex],[data-grammar-row-press]';
    const seen = new Set(); const out = [];
    let rows = 0;
    document.querySelectorAll(sel).forEach((e) => {
      if (!vis(e) || chrome(e)) return;
      if (e.closest('[role=dialog],[aria-modal=true]')) return;
      const r = e.getBoundingClientRect();
      if (r.top > 1000 || r.bottom < 0 || r.left > 1440) return;
      const isRow = e.matches('tr,[role=row]') || e.matches('[data-grammar-row-press]');
      const inner = e.matches('tr,[role=row]') && e.querySelector('[data-grammar-row-press],a[href]');
      if (inner) return; // the inner control carries the hotspot
      if (e.closest('thead') || e.querySelector('th')) return;
      if (/trợ lý NIVO/i.test(e.getAttribute('aria-label') || e.innerText || '')) return; // the floating assistant button is app chrome
      if (/^(trang|page)/i.test((e.getAttribute('aria-label') || e.innerText || '').trim())) return;
      if (isRow && ++rows > 3) return;
      const text = (e.getAttribute('aria-label') || e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      const bx = { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
      const id = `${bx.x},${bx.y},${bx.w},${bx.h}`;
      if (seen.has(id)) return; seen.add(id);
      const a = e.closest('a[href]');
      const submit = e.matches('button') && (e.type === 'submit' || (e.closest('form') && e.type !== 'button'));
      e.setAttribute('data-gl', String(out.length));
      out.push({ i: out.length, label: text, box: bx, href: a ? a.getAttribute('href') : null, to: e.getAttribute('data-gallery-to') || e.closest('[data-gallery-to]')?.getAttribute('data-gallery-to') || null,
        isRow, danger: !a && !isRow && (re.test(text) || submit), submit, role: e.getAttribute('role') || e.tagName.toLowerCase(), expanded: e.getAttribute('aria-haspopup') });
    });
    return out;
  }, DANGER.source);

  const dialogs = () => p.evaluate(() => [...document.querySelectorAll('[role=dialog],[aria-modal=true],[data-component=Drawer],[data-component=Modal],[data-component=Sheet]')].filter((d) => { const r = d.getBoundingClientRect(); return r.width >= 340 && r.height >= 200; }).length);
  const visited = new Map(); const queue = [BASEA + '/workbench'];
  for (const s of ['work', 'work?view=runs', 'workflows', 'graph', 'chat', 'connections', 'knowledge', 'setup', 'setup/general']) queue.push(BASEA + '/' + s);
  let pages = []; const skipped = []; const retried = new Set();
  if (process.env.MERGE) { // add pages to an earlier capture: SEEDS=<comma separated sub-paths of the installation>
    const prev = JSON.parse(fs.readFileSync(path.join(OUT, agent + '.json'), 'utf8')); pages = prev.pages; skipped.push(...(prev.skipped || [])); for (const x of pages) visited.set(x.key, 1);
    queue.length = 0; for (const x of (process.env.SEEDS || '').split(',').filter(Boolean)) queue.push(x.startsWith('/') ? x : BASEA + '/' + x);
  }
  const norm = (u) => new URL(u, BASE).pathname + new URL(u, BASE).search;
  while (queue.length && pages.length < MAXP) {
    const u = queue.shift();
    const k0 = key(u);
    if (visited.has(k0)) continue;
    await go(u);
    const here = norm(p.url());
    const k = key(p.url());
    if (visited.has(k)) { if (k !== k0 && !retried.has(u)) { retried.add(u); console.log('  bounce', k0, '->', k, '(retry)'); queue.unshift(u); visited.delete(k0); } else visited.set(k0, 1); continue; }
    visited.set(k, 1); visited.set(k0, 1);
    if (!here.startsWith(new URL(BASEA, BASE).pathname)) { console.log('  out of scope', k0, '->', k); continue; }
    let cands = await extract();
    for (let t = 0; t < 6 && cands.filter((c) => !c.href || !/agents\/[^/]+\/[0-9a-f-]{36}\/[a-z]+$/.test(c.href)).length < 1; t++) { await p.waitForTimeout(8000); cands = await extract(); } // still compiling / loading
    await p.waitForTimeout(4000); cands = await extract(); // data tables fill in after the first paint
    const links = [];
    let nclick = 0, inPage = 0;
    for (const c of cands) {
      const { i, label, box } = c;
      let rec = { label, box, href: c.href, kind: 'page', clicked: false };
      if (c.href && !c.href.startsWith('#') && !c.href.startsWith('mailto:')) {
        const tk = key(c.href); rec.toKey = tk; rec.url = norm(c.href);
        const same = tk === k;
        if (same) { rec.kind = 'self'; }
      } else if (c.to) {
        rec.toKey = c.to; rec.kind = 'page'; rec.data = true;
      } else if (c.danger) {
        skipped.push({ page: k, label }); continue;
      } else if (c.submit) { skipped.push({ page: k, label, why: 'submit' }); continue; }
      else if (nclick < 26) {
        nclick++; rec.clicked = true;
        const before = p.url(); const dBefore = await dialogs();
        await p.mouse.click(box.x + box.w / 2, box.y + box.h / 2 - await p.evaluate(() => scrollY)).catch(() => undefined);
        await p.waitForTimeout(900);
        const after = p.url(); const dAfter = await dialogs();
        if (norm(after) !== norm(before) || key(after) !== key(before)) {
          const nk = key(after);
          const sameBase = key(before).split('?')[0] === nk.split('?')[0] && nk === key(before);
          rec.toKey = nk; rec.url = norm(after);
          if (nk === key(before)) { rec.kind = 'overlay'; rec.hint = 'query'; } else rec.kind = 'page';
        } else if (dAfter > dBefore) {
          rec.kind = 'overlay'; rec.toKey = k;
          rec.hint = await p.evaluate(() => { const d = document.querySelector('[role=dialog],[aria-modal=true]'); return (d?.querySelector('h1,h2,h3,[role=heading]')?.innerText || d?.innerText || '').trim().slice(0, 50); }).catch(() => '');
        } else { rec.toKey = null; rec.kind = c.role === 'tab' ? 'tab' : 'state'; if (rec.kind === 'state') inPage++; }
        if (rec.kind !== 'none' && rec.kind !== 'state') {
          // put the page back the way it was
          if (dAfter > dBefore) { await p.keyboard.press('Escape'); await p.waitForTimeout(500); }
          if (rec.kind === 'tab' || norm(p.url()) !== norm(before) || (await dialogs()) > dBefore) await go(before);
          else await p.waitForTimeout(100);
          await p.evaluate(() => { document.querySelectorAll('[data-gl]').forEach((e) => e.removeAttribute('data-gl')); }).catch(() => undefined);
          // re-mark candidates after a reload of the page state
          await extract();
        }
      }
      if (rec.kind === 'state') continue;
      links.push(rec);
      if (rec.kind === 'page' && rec.url && rec.url.startsWith(new URL(BASEA, BASE).pathname)) queue.push(rec.url);
    }
    pages.push({ key: k, url: here.replace(ws, '<ws>').replace(/[0-9a-f-]{36}/, '<inst>'), inPageControls: inPage, links });
    console.log(`page ${pages.length} ${k} links=${links.length} (overlay ${links.filter((l) => l.kind === 'overlay').length}, in-page ${inPage})`);
    fs.writeFileSync(path.join(OUT, agent + '.json'), JSON.stringify({ agent, at: new Date().toISOString(), blockedMutations: blocked, pages, skipped }, null, 1));
  }
  console.log('non-GET requests', [...seenNonGet].join(' ; ')); console.log('done pages', pages.length, 'links', pages.reduce((n, x) => n + x.links.length, 0), 'blocked mutations', blocked, 'skipped', skipped.length);
  await b.close();
})().catch((e) => { console.log('STOPPED', String(e.stack || e.message).slice(0, 400)); process.exit(1); });
