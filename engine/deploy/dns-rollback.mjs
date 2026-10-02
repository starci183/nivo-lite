#!/usr/bin/env node
// Puts the apex back on Netlify: A nivo.vn -> 75.2.60.5, proxied through Cloudflare (the state before the VPS cutover).
// The token comes from the single secrets file (section [cloudflare]: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE), so run it through with-secrets:
//   node scripts/with-secrets.mjs node engine/deploy/dns-rollback.mjs            -> applies the rollback
//   node scripts/with-secrets.mjs node engine/deploy/dns-rollback.mjs --dry-run  -> shows what it would change
//   ... --forward                                                                -> the opposite: apex -> VPS 103.142.27.9, DNS only, TTL 60 (the cutover)
// Only the apex A record is touched. www stays a CNAME to nivo.vn; every other record in the zone belongs to other systems.
const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneName = process.env.CLOUDFLARE_ZONE || "nivo.vn";
if (!token) throw new Error("CLOUDFLARE_API_TOKEN is not set (secrets.env section [cloudflare]; run via scripts/with-secrets.mjs)");
const dry = process.argv.includes("--dry-run");
const forward = process.argv.includes("--forward");
const target = forward
  ? { content: "103.142.27.9", proxied: false, ttl: 60 }
  : { content: "75.2.60.5", proxied: true, ttl: 1 };

const api = async (path, init) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  const body = await res.json();
  if (!body.success) throw new Error(`Cloudflare ${path}: ${JSON.stringify(body.errors)}`);
  return body.result;
};

const [zone] = await api(`/zones?name=${zoneName}`);
if (!zone) throw new Error(`zone ${zoneName} not found`);
const [rec] = await api(`/zones/${zone.id}/dns_records?type=A&name=${zoneName}`);
if (!rec) throw new Error(`no A record for ${zoneName}`);
console.log(`A ${rec.name}: ${rec.content} proxied=${rec.proxied} ttl=${rec.ttl}  ->  ${target.content} proxied=${target.proxied} ttl=${target.ttl}${dry ? "  (dry run)" : ""}`);
if (!dry) {
  await api(`/zones/${zone.id}/dns_records/${rec.id}`, { method: "PATCH", body: JSON.stringify(target) });
  console.log("done. Proxied records answer with a 5 minute TTL: allow up to 5 minutes for every resolver to follow.");
}
