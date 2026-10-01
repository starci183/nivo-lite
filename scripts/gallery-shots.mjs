// Screenshots every main page of nivo.vn (public, owner, staff, phone) with the ready accounts from secrets.env.
// Usage: node scripts/gallery-shots.mjs   (writes JPEGs to $TEMP/gallery/shots)
import fs from "node:fs";
import { chromium } from "playwright";
const env = Object.fromEntries(fs.readFileSync(process.env.USERPROFILE + "/.nivo-lite/secrets.env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const out = process.env.TEMP + "/gallery/shots";
const BASE = "https://nivo.vn";
const PUBLIC = [["login", "/login"], ["signup", "/signup"], ["forgot", "/forgot-password"]];
const OWNER = [["workspaces", "/workspaces"], ["workspaces-new", "/workspaces/new"], ["office", "/chat"], ["dashboard", "/dashboard"],
  ["modules", "/m"], ["chatbot-setup", "/m/chatbot"], ["chatbot-workbench", "/m/chatbot/workbench"], ["chatbot-settings", "/m/chatbot/settings"],
  ["sales-workbench", "/m/sales/workbench"], ["accounting-setup", "/m/accounting"], ["accounting-workbench", "/m/accounting/workbench"], ["accounting-settings", "/m/accounting/settings"],
  ["knowledge", "/knowledge"], ["knowledge-nivo", "/knowledge/nivo"], ["connections", "/connections"], ["team", "/team"], ["authority", "/authority"], ["account", "/account"]];
const STAFF = [["staff-office", "/chat"], ["staff-chatbot-workbench", "/m/chatbot/workbench"]];
const b = await chromium.launch();
const shoot = async (ctx, list, tag) => {
  const p = await ctx.newPage(); const res = [];
  for (const [name, path] of list) {
    const r = await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82 });
    res.push([name, path, r?.status(), new URL(p.url()).pathname]);
  }
  return res;
};
const login = async (ctx, email, pw) => { const p = await ctx.newPage(); await p.goto(BASE + "/login"); await p.locator('input[type="email"]').fill(email); await p.locator('input[type="password"]').fill(pw); await p.locator('input[type="password"]').press("Enter"); await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }); await p.close(); };
const desk = { viewport: { width: 1440, height: 900 }, locale: "vi-VN" };
const all = [];
all.push(...await shoot(await b.newContext(desk), PUBLIC));
const o = await b.newContext(desk); await login(o, env.READY_OWNER_EMAIL, env.READY_OWNER_PASSWORD); all.push(...await shoot(o, OWNER));
const s = await b.newContext(desk); await login(s, env.READY_STAFF_EMAIL, env.READY_STAFF_PASSWORD); all.push(...await shoot(s, STAFF));
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, locale: "vi-VN" }); await login(m, env.READY_OWNER_EMAIL, env.READY_OWNER_PASSWORD);
all.push(...await shoot(m, [["mobile-office", "/chat"], ["mobile-modules", "/m"], ["mobile-knowledge", "/knowledge"]]));
for (const r of all) console.log(r.join("  "));
await b.close();
