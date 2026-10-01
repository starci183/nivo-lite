// Local check of the support actions + the 404 for non-admins. Run: node scripts/with-secrets.mjs node scripts/admin-act.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const base = "http://localhost:3190";
const b = await chromium.launch();
async function login(email, pw) {
  const p = await (await b.newContext()).newPage();
  await p.goto(base + "/login");
  await p.fill("#login-email", email);
  await p.fill("#login-password", pw);
  await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  return p;
}
const n = await login(process.env.DEMO_EMAIL, process.env.DEMO_PASSWORD);
console.log("non-admin status", (await n.goto(base + "/admin")).status());
const p = await login(process.env.READY_OWNER_EMAIL, process.env.READY_OWNER_PASSWORD);
await p.goto(base + "/admin");
await p.locator("tbody a").first().click();
await p.waitForURL(/\/admin\/[0-9a-f-]{36}/);
const confirm = async (name) => {
  await p.getByRole("button", { name, exact: true }).click();
  await p.getByRole("button", { name: "Confirm", exact: true }).click();
  await p.waitForTimeout(2500);
};
await confirm("Extend");
console.log("extended msg", await p.locator("text=Extended by 30 days").count());
await confirm("Mark past due");
await confirm("Mark active");
await b.close();
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await db.from("platform_audit").select("action,data").like("action", "workspace.%");
console.log(JSON.stringify(data));
const ws = await db.from("workspaces").select("status,paid_until").limit(5);
console.log(JSON.stringify(ws.data));
