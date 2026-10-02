#!/usr/bin/env node
// Signs the demo owner in WITHOUT a password (service-role magic-link token -> verifyOtp) and times signed-in pages against a running server.
//   NIVO_SECRETS=... node scripts/with-secrets.mjs node scripts/perf-measure.mjs [baseUrl] [email] [paths,comma,separated]
// Start the server with PERF_LOG=1 to also get per-request query counts in its log. Prints no secrets.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const base = process.argv[2] || "http://localhost:3100";
const email = process.argv[3] || "mai@nivo.vn";
const paths = (process.argv[4] || "/dashboard,/automations,/knowledge,/m/chatbot,/chat,/connections,/leads,/billing").split(",");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, service, { auth: { persistSession: false } });
const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (link.error) throw new Error(link.error.message);
const jar = new Map();
const ssr = createServerClient(url, anon, {
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) },
});
const v = await ssr.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
if (v.error) throw new Error(v.error.message);
const cookie = () => [...jar].map(([k, val]) => `${k}=${val}`).join("; ");

for (const p of paths) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    const res = await fetch(base + p, { headers: { cookie: cookie() }, redirect: "manual" });
    await res.arrayBuffer();
    // keep what a browser keeps (the 60 s membership-gate cookie, refreshed tokens) so repeat visits are measured as a person would see them
    for (const c of res.headers.getSetCookie()) { const [pair] = c.split(";"); const i = pair.indexOf("="); if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1)); }
    runs.push(`${res.status} ${Math.round(performance.now() - t)}ms`);
  }
  console.log(p.padEnd(18), runs.join("  |  "));
}
