#!/usr/bin/env node
// Production check of the loyalty module. Needs the service role and the engine secret (run through scripts/with-secrets.mjs):
//   node scripts/with-secrets.mjs node scripts/loyalty-prod-check.mjs <step> [args]
// Steps:  setup   workspace "Kiểm thử · Cửa hàng bán lẻ": modules, programme, rewards, 10 customers (+1 duplicate phone), chats, paid orders and invoices
//         tick    the signed minute tick (earning catch-up, expiry, automations) and what it produced
//         redeem  API: a redeem within the limit (auto) and one above it (ask)
//         promo   API: a segment promotion (OpenClaw draft, gate waiting) with the timing
//         preview signed tick "inspect": the birthday / tier / expiring / win-back cards with their preview text
//         chat    a real customer turn through the engine: "em còn bao nhiêu điểm"
//         report  a summary of the ledger, tiers, work items and automation runs
// Everything it creates is named "Kiểm thử …" and lives in that one workspace. It never prints a secret.
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const WS_NAME = "Kiểm thử · Cửa hàng bán lẻ";
const SLUG = "kiem-thu-ban-le";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nivo.vn").replace(/\/$/, "");
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const step = process.argv[2] ?? "report";
const j = (v) => console.log(JSON.stringify(v, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

const wsId = async (create = false) => {
  const found = (await db.from("workspaces").select("id").eq("name", WS_NAME).limit(1)).data?.[0]?.id;
  if (found || !create) return found ?? null;
  const users = (await db.auth.admin.listUsers({ perPage: 200 })).data?.users ?? [];
  const owner = users.find((u) => u.email === process.env.READY_OWNER_EMAIL) ?? users[0];
  return must(await db.from("workspaces").insert({ name: WS_NAME, owner_id: owner.id }).select("id").single(), "workspace").id;
};

const tickCall = async (body = {}) => {
  const secret = process.env.ENGINE_SHARED_SECRET;
  const key = createHmac("sha256", secret).update("automation-tick").digest("hex");
  const ts = String(Date.now());
  const sig = createHmac("sha256", key).update(ts).digest("hex");
  const t0 = Date.now();
  const res = await fetch(`${site}/api/automation/tick`, { method: "POST", headers: { "content-type": "application/json", "x-tick-timestamp": ts, "x-tick-signature": sig }, body: JSON.stringify(body) });
  return { status: res.status, ms: Date.now() - t0, body: await res.json().catch(() => null) };
};

const apiKey = async (ws) => {
  const name = "Kiểm thử loyalty";
  await db.from("workspace_api_keys").delete().eq("workspace_id", ws).eq("name", name);
  const key = `nvk_${randomBytes(32).toString("base64url")}`;
  must(await db.from("workspace_api_keys").insert({ workspace_id: ws, name, key_prefix: key.slice(0, 12), key_hash: createHash("sha256").update(key).digest("hex"), scopes: ["loyalty:read", "loyalty:write"] }), "api key");
  return key;
};
const api = async (key, method, path, body) => {
  const t0 = Date.now();
  const res = await fetch(`${site}/api/v1/loyalty/${path}`, { method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, ms: Date.now() - t0, body: await res.json().catch(() => null) };
};

/* ------------------------------------------------------------------ setup */
const CUSTOMERS = [
  // name, phone as typed, email, channel, birthday offset (null | "today"), orders [amount, daysAgo, items]
  ["Kiểm thử Lan", "0912 345 601", "lan@kiem-thu.test", "website", null, [[2_500_000, 20, "Giày da nữ"], [4_400_000, 12, "Túi xách da"], [5_500_000, 3, "Áo khoác"]]],
  ["Kiểm thử Minh", "+84 912 345 602", "minh@kiem-thu.test", "website", null, [[1_800_000, 14, "Áo sơ mi"], [3_000_000, 2, "Quần tây"]]],
  ["Kiểm thử Hoa", "84912345603", null, "website", null, [[3_200_000, 5, "Váy"]]],
  ["Kiểm thử Nam", "0912345604", null, "website", null, [[1_250_000, 4, "Giày thể thao"]]],
  ["Kiểm thử Bình", "0912345605", null, "website", null, [[420_000, 6, "Tất"]]],
  ["Kiểm thử Cúc", "0912345606", null, "website", null, [[900_000, 9, "Mũ"]]],
  ["Kiểm thử Dũng", "0912345607", null, "website", null, [[180_000, 1, "Dây nịt"]]],
  ["Kiểm thử Em", "0912345608", null, "website", null, [[650_000, 8, "Ví"]]],
  ["Kiểm thử Linh", "0912345609", "linh@kiem-thu.test", "website", "today", [[600_000, 10, "Khăn"]]],
  ["Kiểm thử Tâm", "0912345610", null, "telegram", null, [[300_000, 7, "Khăn len"]]],
  // the same person as Lan with the phone typed another way: must NOT become a second customer
  ["Kiểm thử Lan (số cũ)", "(+84) 912-345-601", null, "website", null, [[500_000, 2, "Dây chuyền"]]],
];
const ago = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const vnToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

const setup = async () => {
  const ws = await wsId(true);
  console.log("workspace", ws);
  const mod = (k) => JSON.parse(readFileSync(`resources/modules/${k}/module.json`, "utf8"));
  // modules: chatbot (the chat) and loyalty, both on autopilot (assist mode would turn every auto rule into a question)
  const agents = {};
  for (const k of ["chatbot", "loyalty"]) {
    const m = mod(k);
    let a = (await db.from("agents").select("id").eq("workspace_id", ws).eq("module", k).limit(1)).data?.[0];
    if (!a) a = must(await db.from("agents").insert({ workspace_id: ws, module: k, name: m.agent.name, handle: m.agent.handle, role: m.agent.role.vi, instructions: m.agent.instructions.vi, knowledge: k === "chatbot" ? "Cửa hàng bán lẻ thời trang Kiểm thử. Giờ mở cửa 8:00 - 21:00 mỗi ngày. Giao hàng toàn quốc." : "" }).select("id").single(), "agent");
    agents[k] = a.id;
    const inst = (await db.from("module_installations").select("id").eq("workspace_id", ws).eq("module_key", k).maybeSingle()).data;
    if (inst) must(await db.from("module_installations").update({ status: "live", operating_mode: "autopilot", live_enabled: true }).eq("id", inst.id), "installation");
    else must(await db.from("module_installations").insert({ workspace_id: ws, module_key: k, agent_id: a.id, status: "live", operating_mode: "autopilot", live_enabled: true }), "installation");
    must(await db.from("authority_rules").upsert(m.authority_actions.map((x) => ({ workspace_id: ws, department: k, action: x.action, mode: x.mode, limit_vnd: x.limit_vnd, required_fields: x.required_fields })), { onConflict: "workspace_id,department,action" }), "rules");
  }
  // programme: created 120 days ago, sending window all day so the check does not depend on the clock
  const cfg = JSON.parse(readFileSync("resources/loyalty/defaults.json", "utf8"));
  cfg.promo.hourFrom = "00:00"; cfg.promo.hourTo = "23:59";
  must(await db.from("loyalty_programs").upsert({ workspace_id: ws, slug: SLUG, name: WS_NAME, enabled: true, config: cfg, created_at: ago(120) }, { onConflict: "workspace_id" }), "programme");
  // rewards
  const presets = JSON.parse(readFileSync("resources/loyalty/reward-presets.json", "utf8"));
  const extra = [{ key: "qua-600k", name: "Kiểm thử Quà cao cấp", kind: "item", valueVnd: 600000, percent: null, pointsCost: 1500, stock: 5, perCustomerLimit: 1, minTierKey: null, note: "Giá trị trên hạn mức tự đổi." }];
  for (const r of [...presets, ...extra]) {
    must(await db.from("loyalty_rewards").upsert({ workspace_id: ws, key: r.key, name: r.name, kind: r.kind, value_vnd: r.valueVnd, percent: r.percent, points_cost: r.pointsCost, stock: r.stock, per_customer_limit: r.perCustomerLimit, min_tier_key: r.minTierKey, note: r.note }, { onConflict: "workspace_id,key" }), "reward");
  }
  // customers: leads, chats, paid orders and invoices
  let n = 0;
  for (const [name, phone, email, channel, bday, orders] of CUSTOMERS) {
    const norm = (phone.replace(/\D/g, "").replace(/^0/, "84"));
    let lead = (await db.from("leads").select("id").eq("workspace_id", ws).eq("contact_name", name).maybeSingle()).data;
    if (!lead) lead = must(await db.from("leads").insert({ workspace_id: ws, contact_name: name, company: "—", channel: channel === "telegram" ? "Telegram" : "Website chat", need: "Mua sắm thời trang", stage: orders.length ? "won" : "new", phone: norm, email, origin: "simulated" }).select("id").single(), "lead");
    let conv = (await db.from("agent_conversations").select("id").eq("lead_id", lead.id).maybeSingle()).data;
    if (!conv) conv = must(await db.from("agent_conversations").insert({ workspace_id: ws, agent_id: agents.chatbot, kind: "customer", visitor_name: name, lead_id: lead.id, channel, external_id: channel === "telegram" ? `99000${n}` : null }).select("id").single(), "conversation");
    for (const [i, [amount, days, items]] of orders.entries()) {
      const no = `KT-${String(n + 1).padStart(2, "0")}${i + 1}`;
      let order = (await db.from("orders").select("id").eq("workspace_id", ws).eq("order_no", no).maybeSingle()).data;
      if (!order) order = must(await db.from("orders").insert({ workspace_id: ws, lead_id: lead.id, order_no: no, items, amount_vnd: amount, status: "paid", origin: "simulated", confirmed_by: "Kiểm thử", confirmed_at: ago(days) }).select("id").single(), "order");
      const inv = (await db.from("invoices").select("id").eq("workspace_id", ws).eq("invoice_no", `INV-${no}`).maybeSingle()).data;
      if (!inv) {
        const made = must(await db.from("invoices").insert({ workspace_id: ws, order_id: order.id, lead_id: lead.id, invoice_no: `INV-${no}`, amount_vnd: amount, status: "paid", origin: "simulated", issued_by: "Kiểm thử", issued_at: ago(days), paid_at: ago(days) }).select("id").single(), "invoice");
        must(await db.from("transactions").insert({ workspace_id: ws, channel: "bank", amount_vnd: amount, reference: no, payer: name, occurred_at: ago(days), invoice_id: made.id, status: "matched", origin: "simulated" }), "transaction");
      }
    }
    n += 1;
  }
  console.log("setup done: 11 leads (10 people, one of them twice with another phone format), orders and invoices paid at different dates");
  console.log("today (VN)", vnToday());
};

/* ------------------------------------------------------------------ the rest */
const members = async (ws) => {
  const cs = (await db.from("loyalty_customers").select("id, name, phone, tier_key, birthday").eq("workspace_id", ws).order("created_at")).data ?? [];
  const bs = (await db.from("loyalty_balances").select("customer_id, points, lifetime_spend_vnd, visits, last_visit_at").eq("workspace_id", ws)).data ?? [];
  return cs.map((c) => ({ ...c, ...(bs.find((b) => b.customer_id === c.id) ?? {}) }));
};

const tick = async () => {
  const ws = await wsId();
  // 1. nothing is linked here: the app's own earning code (resolveCustomer) creates ONE customer per normalised phone and links the lead and its chats
  await db.from("loyalty_customers").update({ birthday: vnToday().replace(/^\d{4}/, "1992") }).eq("workspace_id", ws).eq("name", "Kiểm thử Linh");
  // 2. enable the four automations
  for (const [key, name] of [["loyalty_birthday", "Chúc mừng sinh nhật kèm quà"], ["loyalty_tier_up", "Chúc mừng lên hạng"], ["loyalty_expiring", "Báo điểm sắp hết hạn"], ["loyalty_winback", "Mời khách thân thiết lâu không quay lại"]]) {
    must(await db.from("automation_pipelines").upsert({ workspace_id: ws, template_key: key, name, module_key: "loyalty", enabled: true, config: key === "loyalty_winback" ? { offer: "tặng 50 điểm cho đơn kế tiếp" } : {}, body: null }, { onConflict: "workspace_id,template_key" }), "pipeline");
  }
  const t = await tickCall();
  console.log("tick", t.status, `${t.ms} ms`, JSON.stringify(t.body));
  await sleep(2000);
  j({ customers: (await members(ws)).map((m) => ({ name: m.name, phone: m.phone, tier: m.tier_key, points: m.points, spend: m.lifetime_spend_vnd, visits: m.visits })) });
};

const redeem = async () => {
  const ws = await wsId();
  const key = await apiKey(ws);
  const who = (await members(ws)).sort((a, b) => b.points - a.points);
  const top = who[0];
  console.log("customer with most points:", top.name, top.points);
  const within = await api(key, "POST", "redeem", { phone: top.phone, reward_key: "voucher-50k", ref: `kt-${Date.now()}-a` });
  console.log("redeem within limit (50.000 d < 500.000 d):", within.status, `${within.ms} ms`, JSON.stringify({ status: within.body?.data?.status, path: within.body?.data?.decided_path, result: within.body?.data?.result, points_after: within.body?.data?.customer?.points }));
  const above = await api(key, "POST", "redeem", { phone: top.phone, reward_key: "qua-600k", ref: `kt-${Date.now()}-b` });
  console.log("redeem above limit (600.000 d >= 500.000 d):", above.status, `${above.ms} ms`, JSON.stringify({ status: above.body?.data?.status, reason: above.body?.data?.reason, work_item: above.body?.data?.work_item_id, points_after: above.body?.data?.customer?.points, error: above.body?.error }));
  const lookup = await api(key, "GET", `members?phone=${encodeURIComponent("+84 912 345 601")}`);
  console.log("lookup by another phone format:", lookup.status, JSON.stringify(lookup.body?.data?.members?.map((m) => ({ name: m.name, points: m.points, tier: m.tier }))));
};

const promo = async () => {
  const ws = await wsId();
  const key = await apiKey(ws);
  const out = await api(key, "POST", "promo", { name: "Kiểm thử · Ưu đãi hạng Bạc và Vàng", brief: "Giảm 10% cho đơn kế tiếp trong tuần này khi báo mã THANTHIET", segment: { tiers: ["bac", "vang"] } });
  console.log("promo", out.status, `total request ${out.ms} ms`, JSON.stringify(out.body?.data ?? out.body));
  const camp = (await db.from("loyalty_campaigns").select("id, status, recipients, draft_ms, work_item_id").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(1)).data?.[0];
  const item = camp?.work_item_id ? (await db.from("work_items").select("status, reason, action, proposal").eq("id", camp.work_item_id).single()).data : null;
  j({ campaign: camp, work_item: item && { status: item.status, reason: item.reason, action: item.action, summary: item.proposal?.summary, draft: item.proposal?.draft, source: item.proposal?.fields?.draft_source } });
};

const preview = async () => {
  const ws = await wsId();
  const t = await tickCall({ inspect: ws });
  console.log("inspect", t.status, `${t.ms} ms`);
  j((t.body?.cards ?? []).filter((c) => String(c.key).startsWith("loyalty_")));
};

const chat = async () => {
  const ws = await wsId();
  const lan = (await db.from("leads").select("id").eq("workspace_id", ws).eq("contact_name", "Kiểm thử Lan").single()).data;
  const conv = (await db.from("agent_conversations").select("id, agent_id").eq("lead_id", lan.id).single()).data;
  for (const text of ["em còn bao nhiêu điểm vậy?", "mình đổi phiếu giảm 50.000 được không?"]) {
    const msg = must(await db.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "user", body: text }).select("id").single(), "message");
    const t0 = Date.now();
    must(await db.rpc("engine_enqueue", { p_workspace: ws, p_kind: "chat.turn", p_payload: { conversation_id: conv.id, message_id: msg.id, event_id: `kt:${msg.id}`, agent_id: conv.agent_id, channel: "website" }, p_dedupe_key: `chat.turn:${msg.id}`, p_max_attempts: 2 }), "enqueue");
    let reply = null;
    while (Date.now() - t0 < 120_000) {
      await sleep(2000);
      reply = (await db.from("agent_messages").select("role, body, created_at").eq("conversation_id", conv.id).gt("created_at", new Date(t0 - 1000).toISOString()).eq("role", "agent").order("created_at").limit(1)).data?.[0];
      if (reply) break;
    }
    console.log(`Q: ${text}\nA (${((Date.now() - t0) / 1000).toFixed(1)} s): ${reply?.body ?? "(no reply in 120 s)"}`);
  }
  const wi = (await db.from("work_items").select("action, status, reason, proposal").eq("workspace_id", ws).eq("action", "redeem_reward").order("created_at", { ascending: false }).limit(3)).data ?? [];
  j(wi.map((w) => ({ status: w.status, reason: w.reason, summary: w.proposal?.summary, source: w.proposal?.fields?.source })));
};

const report = async () => {
  const ws = await wsId();
  const ms = await members(ws);
  const led = (await db.from("loyalty_ledger").select("kind, points, by_name, ref, evidence, occurred_at, customer_id").eq("workspace_id", ws).order("occurred_at")).data ?? [];
  const items = (await db.from("work_items").select("action, status, decided_path, reason, created_at").eq("workspace_id", ws).in("action", ["award_points", "redeem_reward", "send_promo", "adjust_points"])).data ?? [];
  const runs = (await db.from("automation_runs").select("status, trigger_ref, summary:evidence, steps, created_at, automation_pipelines(template_key)").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(20)).data ?? [];
  const tally = (a, f) => a.reduce((o, x) => ((o[f(x)] = (o[f(x)] ?? 0) + 1), o), {});
  j({
    customers: ms.length, duplicate_leads_merged: (await db.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", ws)).count - ms.length,
    members: ms.map((m) => ({ name: m.name, tier: m.tier_key, points: m.points, spend: Number(m.lifetime_spend_vnd), visits: m.visits })),
    ledger_by_kind: tally(led, (l) => l.kind), ledger_total_points: led.reduce((n, l) => n + l.points, 0), members_total_points: ms.reduce((n, m) => n + (m.points ?? 0), 0),
    work_items: tally(items, (i) => `${i.action}:${i.status}:${i.decided_path ?? "-"}:${i.reason ?? "-"}`),
    events: tally((await db.from("events").select("kind").eq("workspace_id", ws).like("kind", "loyalty.%")).data ?? [], (e) => e.kind),
    automation_runs: runs.map((r) => ({ template: r.automation_pipelines?.template_key, status: r.status, at: r.created_at, steps: (r.steps ?? []).map((s) => `${s.status}: ${s.label}`) })),
  });
};

const steps = { setup, tick, redeem, promo, preview, chat, report };
if (!steps[step]) { console.error(`unknown step "${step}". Steps: ${Object.keys(steps).join(", ")}`); process.exit(1); }
await steps[step]();
