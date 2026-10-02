#!/usr/bin/env node
// Fetches the same signed-in pages from two servers (before/after) and prints the visible-text lines that differ. No secrets printed.
//   node scripts/with-secrets.mjs node scripts/perf-compare.mjs http://localhost:3101 http://localhost:3100 [email] [paths]
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const [a, b, email = "mai@nivo.vn", list] = process.argv.slice(2);
const paths = (list || "/dashboard,/automations,/knowledge,/m/chatbot,/chat,/connections,/leads,/billing").split(",");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
const jar = new Map();
const ssr = createServerClient(url, anon, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
const v = await ssr.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
if (v.error) throw new Error(v.error.message);
const cookie = [...jar].map(([k, val]) => `${k}=${val}`).join("; ");
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
for (const p of paths) {
  const [x, y] = await Promise.all([a, b].map(async (base) => text(await (await fetch(base + p, { headers: { cookie }, redirect: "manual" })).text())));
  const sx = new Set(x), sy = new Set(y);
  const onlyA = x.filter((l) => !sy.has(l)), onlyB = y.filter((l) => !sx.has(l));
  console.log(`${p}: ${x.length} vs ${y.length} lines; only-before ${onlyA.length}, only-after ${onlyB.length}`);
  for (const l of onlyA.slice(0, 8)) console.log("  - " + l.slice(0, 140));
  for (const l of onlyB.slice(0, 8)) console.log("  + " + l.slice(0, 140));
}
