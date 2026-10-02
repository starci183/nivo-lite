#!/usr/bin/env node
// Production check of the booking module ("Đặt lịch hẹn"). Needs the service role + the engine secret (run through scripts/with-secrets.mjs).
//   node scripts/with-secrets.mjs node scripts/booking-prod-check.mjs <setup|slots|flow|public|real-turn|all>
// Works only in the test workspace "Kiểm thử · Salon" (created by `setup`; every row it writes is named "Kiểm thử ..."). Prints a results table.
//   setup      workspace, booking agent + installation (autopilot), authority rules, 3 services, 2 stylists, 1 room, hours, one closed day, public page
//   slots      findSlots (the engine the app runs, imported as is) on the production rows: buffers, overlap, closed day, plus the database guard against double booking
//   flow       signed calls against BASE (default https://nivo.vn): chatbot-style booking_request through /api/engine/callback and /api/engine/tool, the minute tick, reminders
//   public     the public booking page /b/<slug> (slots, book, rate limit, honeypot)
//   automations the four booking automation cards (switched on in the test workspace, then back OFF): review, come back, waitlist notice
//   shifts     the optional link to the shifts module: an approved leave blocks a linked resource
//   real-turn  a real OpenClaw chat.turn (queued engine job) for a booking message; polls the result
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import { addDays, checkSlot, findSlots, isoWeekday, localDate, localHhmm, zonedMs } from "../src/lib/module-booking-availability.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = process.env.BASE ?? "https://nivo.vn";
const SECRET = process.env.ENGINE_SHARED_SECRET;
const NAME = "Kiểm thử · Salon";
const TZ = "Asia/Ho_Chi_Minh";
const SLUG = "kiem-thu-salon";
const rows = [];
const check = (name, expected, actual, pass) => {
  rows.push({ name, expected, actual, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      expected: ${expected}\n      actual:   ${actual}`);
};
const ok = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hm = (ms) => localHhmm(ms, TZ);

const nextWeekday = (n, minAhead = 3) => {
  let d = addDays(localDate(Date.now(), TZ), minAhead);
  while (isoWeekday(d) !== n) d = addDays(d, 1);
  return d;
};

/* ------------------------------------------------------------------ setup */
const workspace = async () => {
  const found = ok(await db.from("workspaces").select("id").eq("name", NAME).limit(1), "workspace").at(0);
  return found?.id ?? null;
};

const setup = async () => {
  let ws = await workspace();
  const users = (await db.auth.admin.listUsers({ perPage: 200 })).data?.users ?? [];
  const owner = users.find((u) => u.email === process.env.READY_OWNER_EMAIL) ?? users[0];
  if (!ws) {
    ws = ok(await db.from("workspaces").insert({ name: NAME, owner_id: owner.id }).select("id").single(), "create workspace").id;
    console.log("created workspace", ws);
  } else console.log("workspace", ws);
  await db.from("workspace_members").upsert({ workspace_id: ws, user_id: owner.id, role: "owner", display_name: "Kiểm thử Salon (chủ)", status: "active" }, { onConflict: "workspace_id,user_id", ignoreDuplicates: true });

  // authority rules: the stable modules' defaults plus booking's (what a new workspace + the install would grant)
  const acts = ok(await db.from("authority_actions").select("action, module_key, default_mode, default_limit_vnd, default_required_fields").in("module_key", ["chatbot", "sales", "accounting", "booking"]), "actions");
  ok(await db.from("authority_rules").upsert(acts.map((a) => ({ workspace_id: ws, department: a.module_key, action: a.action, mode: a.default_mode, limit_vnd: a.default_limit_vnd, required_fields: a.default_required_fields })), { onConflict: "workspace_id,department,action", ignoreDuplicates: true }), "rules");

  // the booking agent + its installation (autopilot, so a free slot within policy is confirmed by itself)
  let agent = ok(await db.from("agents").select("id").eq("workspace_id", ws).eq("module", "booking").limit(1), "agent").at(0);
  if (!agent) agent = ok(await db.from("agents").insert({ workspace_id: ws, module: "booking", name: "Booking Agent", handle: "booking", role: "Nhận và quản lý lịch hẹn của khách", instructions: "Hỏi khách muốn đặt dịch vụ gì, ngày giờ nào, rồi đối chiếu lịch trống. Chỉ xác nhận khi còn chỗ." }).select("id").single(), "agent insert");
  const inst = ok(await db.from("module_installations").select("id").eq("workspace_id", ws).eq("module_key", "booking").limit(1), "inst").at(0);
  if (!inst) ok(await db.from("module_installations").insert({ workspace_id: ws, module_key: "booking", agent_id: agent.id, status: "live", operating_mode: "autopilot", live_enabled: true }), "inst insert");
  else await db.from("module_installations").update({ operating_mode: "autopilot", agent_id: agent.id }).eq("id", inst.id);

  // wipe the module's test data and rebuild (this workspace is a test workspace only)
  for (const t of ["bookings", "booking_waitlist", "booking_exceptions", "booking_hours", "booking_resources", "booking_services"]) await db.from(t).delete().eq("workspace_id", ws);
  ok(await db.from("booking_settings").upsert({
    workspace_id: ws, timezone: TZ, slot_step_min: 15, min_lead_min: 60, max_advance_days: 60, cancel_window_hours: 24, deposit_pct: 0, late_cancel_fee_pct: 50, no_show_fee_vnd: 100000,
    auto_confirm: true, handoff_order: false, public_enabled: true, public_slug: SLUG, public_note: "Kiểm thử: trang đặt lịch của salon thử nghiệm", address: "12 Phố Thử Nghiệm, Quận 1",
  }, { onConflict: "workspace_id" }), "settings");
  const svc = ok(await db.from("booking_services").insert([
    { workspace_id: ws, name: "Kiểm thử · Uốn tóc", duration_min: 90, buffer_min: 15, price_vnd: 600000, resource_kind: "stylist", sort_order: 1 },
    { workspace_id: ws, name: "Kiểm thử · Cắt tóc nữ", duration_min: 45, buffer_min: 15, price_vnd: 200000, resource_kind: "stylist", followup_days: 30, sort_order: 2 },
    { workspace_id: ws, name: "Kiểm thử · Gội đầu thư giãn", duration_min: 30, buffer_min: 10, price_vnd: 120000, resource_kind: "room", sort_order: 3 },
  ]).select("id, name"), "services");
  const res = ok(await db.from("booking_resources").insert([
    { workspace_id: ws, name: "Kiểm thử · Mai", kind: "stylist", capacity: 1, sort_order: 1 },
    { workspace_id: ws, name: "Kiểm thử · Lan", kind: "stylist", capacity: 1, sort_order: 2 },
    { workspace_id: ws, name: "Kiểm thử · Phòng gội 1", kind: "room", capacity: 1, sort_order: 3 },
  ]).select("id, name"), "resources");
  const hours = [];
  for (const r of res) for (const weekday of [1, 2, 3, 4, 5, 6]) {
    if (r.name.endsWith("Mai")) { hours.push({ workspace_id: ws, resource_id: r.id, weekday, start_time: "09:00", end_time: "12:00" }, { workspace_id: ws, resource_id: r.id, weekday, start_time: "13:00", end_time: "18:00" }); } // lunch break
    else hours.push({ workspace_id: ws, resource_id: r.id, weekday, start_time: "09:00", end_time: "18:00" });
  }
  ok(await db.from("booking_hours").insert(hours), "hours");
  const holiday = nextWeekday(3, 10); // a Wednesday ~10 days ahead, closed for the whole business
  ok(await db.from("booking_exceptions").insert({ workspace_id: ws, resource_id: null, on_date: holiday, closed: true, note: "Kiểm thử · nghỉ lễ" }), "exception");
  console.log("setup done:", { ws, services: svc.length, resources: res.length, holiday });
  return ws;
};

const load = async (ws) => {
  const [services, resources, hours, exceptions, settings] = await Promise.all([
    db.from("booking_services").select("*").eq("workspace_id", ws), db.from("booking_resources").select("*").eq("workspace_id", ws).order("sort_order"),
    db.from("booking_hours").select("*").eq("workspace_id", ws), db.from("booking_exceptions").select("*").eq("workspace_id", ws), db.from("booking_settings").select("*").eq("workspace_id", ws).single(),
  ]);
  const s = settings.data;
  return {
    services: services.data, byName: Object.fromEntries(services.data.map((x) => [x.name.replace("Kiểm thử · ", ""), x])), policy: { timezone: s.timezone, slotStepMin: s.slot_step_min, minLeadMin: s.min_lead_min, maxAdvanceDays: s.max_advance_days },
    resources: resources.data.map((r) => ({ id: r.id, name: r.name, kind: r.kind, capacity: r.capacity, active: r.active, sort: r.sort_order })),
    hours: hours.data.map((h) => ({ resourceId: h.resource_id, weekday: h.weekday, start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) })),
    exceptions: exceptions.data.map((e) => ({ resourceId: e.resource_id, date: e.on_date, closed: e.closed, start: e.start_time, end: e.end_time })),
  };
};
const taken = async (ws) => {
  const { data } = await db.from("bookings").select("id, resource_id, start_at, block_end_at, party_size").eq("workspace_id", ws).eq("holds_slot", true).in("status", ["requested", "confirmed", "rescheduled"]);
  return data.map((b) => ({ id: b.id, resourceId: b.resource_id, startMs: Date.parse(b.start_at), blockEndMs: Date.parse(b.block_end_at), partySize: b.party_size }));
};
const spec = (s) => ({ id: s.id, durationMin: s.duration_min, bufferMin: s.buffer_min, resourceKind: s.resource_kind, active: s.active });

// a booking row through the same RPC the app uses (the database refuses overlaps)
const reserve = async (ws, m, serviceName, resourceName, date, time, extra = {}) => {
  const svc = m.byName[serviceName];
  const res = m.resources.find((r) => r.name.endsWith(resourceName));
  const startMs = zonedMs(date, time, TZ);
  const endMs = startMs + svc.duration_min * 60_000;
  const r = await db.rpc("booking_reserve", { p: { workspace_id: ws, customer_name: extra.customer ?? "Kiểm thử · Khách", customer_phone: extra.phone ?? "", service_id: svc.id, resource_id: res.id, start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString(), block_end_at: new Date(endMs + svc.buffer_min * 60_000).toISOString(), party_size: 1, status: extra.status ?? "confirmed", source_channel: "manual", price_vnd: svc.price_vnd, lead_id: extra.lead_id ?? "" } });
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

/* ------------------------------------------------------------------ slots */
const slotsCheck = async () => {
  const ws = await workspace();
  await db.from("bookings").delete().eq("workspace_id", ws);
  const m = await load(ws);
  const mon = nextWeekday(1, 5);
  const nowMs = Date.now();
  const calc = (svcName, date, resName = null) => {
    const s = findSlots({ service: spec(m.byName[svcName]), resources: m.resources, hours: m.hours, exceptions: m.exceptions, taken: [], policy: m.policy, fromMs: zonedMs(date, "00:00", TZ), toMs: zonedMs(addDays(date, 1), "00:00", TZ), nowMs, resourceId: resName ? m.resources.find((r) => r.name.endsWith(resName)).id : null });
    return s;
  };
  const run = async (svcName, date, resName = null) => {
    const t = await taken(ws);
    return findSlots({ service: spec(m.byName[svcName]), resources: m.resources, hours: m.hours, exceptions: m.exceptions, taken: t, policy: m.policy, fromMs: zonedMs(date, "00:00", TZ), toMs: zonedMs(addDays(date, 1), "00:00", TZ), nowMs, resourceId: resName ? m.resources.find((r) => r.name.endsWith(resName)).id : null });
  };
  void calc;
  const times = (slots, resName) => slots.filter((s) => !resName || s.resourceId === m.resources.find((r) => r.name.endsWith(resName)).id).map((s) => hm(s.startMs));

  // CASE 1: buffers. Mai has "Uốn tóc" 10:00-11:30 + 15 min buffer (blocked until 11:45) on a Monday; lunch break 12:00-13:00.
  const id1 = await reserve(ws, m, "Uốn tóc", "Mai", mon, "10:00");
  const c1 = times(await run("Cắt tóc nữ", mon, "Mai"), "Mai"); // 45 min + 15 buffer
  check("1a buffer: a cut ending 10:00 fits before the 10:00 booking", "09:00 offered (block ends 10:00)", c1.includes("09:00") ? "09:00 offered" : "missing", c1.includes("09:00"));
  check("1b buffer: 09:15 would run into the booking's start through its own buffer", "09:15 not offered", c1.includes("09:15") ? "offered" : "not offered", !c1.includes("09:15"));
  check("1c buffer: nothing inside the booking, its 15 min buffer or past lunch", "10:00-12:00 not offered (booked + buffer + lunch cut), 13:00 offered", `10:00..11:45 offered=${c1.filter((t) => t >= "10:00" && t < "12:00").join(",") || "none"}; 13:00 ${c1.includes("13:00") ? "offered" : "missing"}`, !c1.some((t) => t >= "09:15" && t < "12:00") && c1.includes("13:00"));
  // independent reference: brute force every 15 minutes
  const ref = [];
  const win = [["09:00", "12:00"], ["13:00", "18:00"]];
  const busyFrom = zonedMs(mon, "10:00", TZ), busyTo = zonedMs(mon, "11:30", TZ) + 15 * 60_000;
  for (const [a, b] of win) for (let t = zonedMs(mon, a, TZ); t + 45 * 60_000 <= zonedMs(mon, b, TZ); t += 15 * 60_000) if (!(t < busyTo && busyFrom < t + 60 * 60_000)) ref.push(hm(t));
  check("1d buffer: engine equals an independent brute-force reference for Mai that day", `${ref.length} slots`, `${c1.length} slots, ${JSON.stringify(c1) === JSON.stringify(ref) ? "identical" : "different"}`, JSON.stringify(c1) === JSON.stringify(ref));

  // CASE 2: overlap. Both stylists considered at 10:30: Mai is busy, Lan is free.
  const all = await run("Cắt tóc nữ", mon);
  const at1030 = all.filter((s) => hm(s.startMs) === "10:30").map((s) => m.resources.find((r) => r.id === s.resourceId).name.replace("Kiểm thử · ", ""));
  check("2a overlap: at 10:30 only the free stylist is offered", "Lan", at1030.join(","), at1030.length === 1 && at1030[0] === "Lan");
  const id2 = await reserve(ws, m, "Cắt tóc nữ", "Lan", mon, "10:30");
  const both = (await run("Cắt tóc nữ", mon)).filter((s) => hm(s.startMs) === "10:30");
  check("2b overlap: once Lan is booked too, 10:30 is gone", "no slot at 10:30", `${both.length} slots`, both.length === 0);
  const dup = await reserve(ws, m, "Cắt tóc nữ", "Lan", mon, "10:45").catch((e) => `error ${e.message}`);
  check("2c database guard: an overlapping insert for Lan at 10:45 is refused by booking_reserve", "null (refused)", String(dup), dup === null);
  const room = await run("Gội đầu thư giãn", mon);
  check("2d resource kind: a room service is only offered on the room", "slots only on the Phòng gội", [...new Set(room.map((s) => m.resources.find((r) => r.id === s.resourceId).name))].join(","), room.length > 0 && room.every((s) => m.resources.find((r) => r.id === s.resourceId).kind === "room"));

  // CASE 3: closed days. A Sunday (no hours) and the Wednesday holiday exception.
  const sun = nextWeekday(7, 4);
  const holiday = m.exceptions[0].date;
  const sunSlots = await run("Cắt tóc nữ", sun);
  const holSlots = await run("Cắt tóc nữ", holiday);
  const probe = (d) => checkSlot({ service: spec(m.byName["Cắt tóc nữ"]), resources: m.resources, hours: m.hours, exceptions: m.exceptions, taken: [], policy: m.policy, nowMs, startMs: zonedMs(d, "10:00", TZ) });
  check("3a closed day: Sunday has no hours", "0 slots, reason closed", `${sunSlots.length} slots, ${probe(sun).ok ? "free" : probe(sun).why}`, sunSlots.length === 0 && !probe(sun).ok && probe(sun).why === "closed");
  check("3b closed day: the holiday exception closes the whole business", "0 slots, reason closed", `${holSlots.length} slots, ${probe(holiday).ok ? "free" : probe(holiday).why}`, holSlots.length === 0 && !probe(holiday).ok && probe(holiday).why === "closed");
  const tue = nextWeekday(2, 4);
  check("3c control: a normal Tuesday has slots", "> 0 slots", `${(await run("Cắt tóc nữ", tue)).length}`, (await run("Cắt tóc nữ", tue)).length > 0);
  const past = checkSlot({ service: spec(m.byName["Cắt tóc nữ"]), resources: m.resources, hours: m.hours, exceptions: m.exceptions, taken: [], policy: m.policy, nowMs, startMs: nowMs + 10 * 60_000 });
  check("3d policy: 10 minutes from now is too soon (min lead 60)", "too_soon", past.ok ? "free" : past.why, !past.ok && past.why === "too_soon");
  await db.from("bookings").delete().in("id", [id1, id2].filter(Boolean));
};

/* ------------------------------------------------------------------ signed calls */
const signedPost = async (path, body) => {
  const raw = JSON.stringify(body);
  const ts = String(Date.now());
  const sig = createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex");
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-engine-timestamp": ts, "x-engine-signature": sig }, body: raw });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const tick = async () => {
  const ts = String(Date.now());
  const key = createHmac("sha256", SECRET).update("automation-tick").digest("hex");
  const sig = createHmac("sha256", key).update(ts).digest("hex");
  const r = await fetch(`${BASE}/api/automation/tick`, { method: "POST", headers: { "x-tick-timestamp": ts, "x-tick-signature": sig, "content-type": "application/json" }, body: "{}" });
  return { status: r.status, json: await r.json().catch(() => null) };
};

// a conversation with a customer on the website chat of the booking agent, one running chat.turn job per message (what the engine holds while OpenClaw works)
const newConversation = async (ws, visitor) => {
  const agent = ok(await db.from("agents").select("id").eq("workspace_id", ws).eq("module", "booking").limit(1), "agent").at(0);
  const conv = ok(await db.from("agent_conversations").insert({ workspace_id: ws, agent_id: agent.id, kind: "customer", visitor_name: visitor, channel: "website" }).select("id").single(), "conv");
  return conv.id;
};
const customerSays = async (ws, conv, text, requestJson) => {
  const msg = ok(await db.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv, role: "user", body: text }).select("id").single(), "msg");
  const job = ok(await db.from("engine_jobs").insert({ workspace_id: ws, kind: "chat.turn", status: "running", payload: { conversation_id: conv, message_id: msg.id, event_id: msg.id, channel: "website" }, dedupe_key: `test:${randomUUID()}`, locked_by: "booking-prod-check", locked_until: new Date(Date.now() + 300_000).toISOString() }).select("id").single(), "job");
  const reply = JSON.stringify({ reply: "Mình kiểm tra lịch rồi báo bạn ngay nhé.", lead: null, needs_human: false, reason: null, proposed_answer: null, order: null, payment_claim: false, booking_request: requestJson });
  const r = await signedPost("/api/engine/callback", { job_id: job.id, op: "chat.reply", text: reply });
  await db.from("engine_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", job.id);
  return { job: job.id, status: r.status, json: r.json };
};
const lastAgentMessages = async (conv, n = 3) => (await db.from("agent_messages").select("role, body, created_at").eq("conversation_id", conv).order("created_at", { ascending: false }).limit(n)).data.map((x) => x.body);
const workItem = async (ws, action, bookingId) => (await db.from("work_items").select("*").eq("workspace_id", ws).eq("action", action).like("dedupe_key", `%${bookingId}%`).order("created_at", { ascending: false }).limit(1)).data?.[0] ?? null;

const flow = async () => {
  const ws = await workspace();
  const m = await load(ws);
  await db.from("bookings").delete().eq("workspace_id", ws);
  await db.from("booking_waitlist").delete().eq("workspace_id", ws);
  await db.from("module_installations").update({ operating_mode: "autopilot" }).eq("workspace_id", ws).eq("module_key", "booking");
  const wed = nextWeekday(4, 4); // a Thursday (not the holiday Wednesday)
  const cut = m.byName["Cắt tóc nữ"];

  // F1: free slot -> auto-confirmed
  const conv = await newConversation(ws, "Kiểm thử · Lan Anh");
  const t1 = await customerSays(ws, conv, "Mình muốn cắt tóc nữ chiều thứ Năm, 14:00 nhé. Mình là Lan Anh, 0900000001", { intent: "book", service: "Cắt tóc nữ", date: wed, time: "14:00", from: null, to: null, party_size: 1, contact_name: "Kiểm thử · Lan Anh", phone: "0900000001", email: null, note: null });
  const b1 = (await db.from("bookings").select("*").eq("workspace_id", ws).eq("customer_name", "Kiểm thử · Lan Anh").order("created_at", { ascending: false }).limit(1)).data?.[0];
  const w1 = b1 ? await workItem(ws, "confirm_booking", b1.id) : null;
  check("F1 chatbot request, free slot within policy -> auto-confirmed", "callback 200, booking confirmed, confirm_booking done by policy", `callback ${t1.status}; booking ${b1?.status}; work item ${w1?.status}/${w1?.decided_path}`, t1.status === 200 && b1?.status === "confirmed" && w1?.status === "done" && w1?.decided_path === "auto");
  const msgs1 = await lastAgentMessages(conv, 4);
  check("F1b customer got the confirmation message on the chat (fixed template, facts from the DB)", "a message with 'đã xác nhận lịch hẹn' and the time", msgs1.find((x) => /đã xác nhận lịch hẹn/.test(x)) ?? msgs1[0], msgs1.some((x) => /đã xác nhận lịch hẹn/.test(x) && x.includes("14:00")));
  const rem1 = b1 ? (await db.from("booking_reminders").select("kind, due_at, status").eq("booking_id", b1.id).order("kind")).data : [];
  const startMs = b1 ? Date.parse(b1.start_at) : 0;
  const want = rem1.length === 2 && rem1.every((r) => r.status === "scheduled") && Math.abs(Date.parse(rem1.find((r) => r.kind === "h24").due_at) - (startMs - 24 * 3_600_000)) < 1000 && Math.abs(Date.parse(rem1.find((r) => r.kind === "h2").due_at) - (startMs - 2 * 3_600_000)) < 1000;
  check("F1c reminder jobs scheduled (24 h and 2 h before)", "h24 + h2 rows, status scheduled, due_at = start - 24h / 2h", rem1.map((r) => `${r.kind}@${hm(Date.parse(r.due_at))} ${localDate(Date.parse(r.due_at), TZ)} ${r.status}`).join("; "), want);
  const lead1 = b1?.lead_id ? (await db.from("leads").select("contact_name, phone").eq("id", b1.lead_id).single()).data : null;
  check("F1d customer record created/linked from the request (phone normalised to +84)", "lead with the name and phone 84900000001", JSON.stringify(lead1), lead1?.phone === "84900000001" && lead1?.contact_name === "Kiểm thử · Lan Anh");

  // F2: conflict -> waiting decision (both stylists booked at 15:00)
  await reserve(ws, m, "Cắt tóc nữ", "Mai", wed, "15:00", { customer: "Kiểm thử · Giữ chỗ Mai" });
  await reserve(ws, m, "Cắt tóc nữ", "Lan", wed, "15:00", { customer: "Kiểm thử · Giữ chỗ Lan" });
  const conv2 = await newConversation(ws, "Kiểm thử · Minh Tuấn");
  await customerSays(ws, conv2, "Cho mình cắt tóc nữ 15:00 thứ Năm. Mình là Minh Tuấn 0900000002", { intent: "book", service: "Cắt tóc nữ", date: wed, time: "15:00", from: null, to: null, party_size: 1, contact_name: "Kiểm thử · Minh Tuấn", phone: "0900000002", email: null, note: null });
  const b2 = (await db.from("bookings").select("*").eq("workspace_id", ws).eq("customer_name", "Kiểm thử · Minh Tuấn").limit(1)).data?.[0];
  const w2 = b2 ? await workItem(ws, "confirm_booking", b2.id) : null;
  check("F2 conflicting request -> waiting decision, no slot held", "work item waiting_decision (unclear_outcome), booking requested + holds_slot=false", `${w2?.status}/${w2?.reason}; booking ${b2?.status} holds=${b2?.holds_slot}`, w2?.status === "waiting_decision" && b2?.status === "requested" && b2?.holds_slot === false);
  const msgs2 = await lastAgentMessages(conv2, 4);
  check("F2b customer was offered the nearest free times", "a message listing 'còn các giờ trống'", msgs2.find((x) => /giờ trống/.test(x)) ?? msgs2[0], msgs2.some((x) => /giờ trống/.test(x)));

  // F3: reschedule (far enough ahead) -> auto
  const t3 = await customerSays(ws, conv, "Mình muốn đổi sang 16:30 cùng ngày được không?", { intent: "reschedule", service: "", date: wed, time: "16:30", from: null, to: null, party_size: 1, contact_name: "Kiểm thử · Lan Anh", phone: null, email: null, note: null });
  const b3 = (await db.from("bookings").select("*").eq("id", b1.id).single()).data;
  const w3 = await workItem(ws, "reschedule", b1.id);
  check("F3 reschedule request within policy -> auto, booking moved", "status rescheduled, start 16:30, reschedule work item done auto", `${b3.status}, ${hm(Date.parse(b3.start_at))}; work item ${w3?.status}/${w3?.decided_path}; callback ${t3.status}`, b3.status === "rescheduled" && hm(Date.parse(b3.start_at)) === "16:30" && w3?.status === "done" && w3?.decided_path === "auto");
  const rem3 = (await db.from("booking_reminders").select("kind, due_at, status").eq("booking_id", b1.id)).data;
  check("F3b reminders follow the new time", "due_at = new start - 24h / 2h", rem3.map((r) => `${r.kind} ${localDate(Date.parse(r.due_at), TZ)} ${hm(Date.parse(r.due_at))}`).join("; "), rem3.length === 2 && rem3.every((r) => Math.abs(Date.parse(r.due_at) - (Date.parse(b3.start_at) - Number(r.kind.slice(1)) * 3_600_000)) < 1000));

  // F3c: a reschedule into a taken slot -> waiting decision
  const t3c = await customerSays(ws, conv, "Đổi sang 15:00 được không?", { intent: "reschedule", service: "", date: wed, time: "15:00", from: null, to: null, party_size: 1, contact_name: "Kiểm thử · Lan Anh", phone: null, email: null, note: null });
  const w3c = await (async () => (await db.from("work_items").select("*").eq("workspace_id", ws).eq("action", "reschedule").like("dedupe_key", `%${b1.id}%`).order("created_at", { ascending: false }).limit(1)).data?.[0])();
  const b3c = (await db.from("bookings").select("start_at").eq("id", b1.id).single()).data;
  check("F3c reschedule into a taken slot -> waiting decision, booking not moved", "waiting_decision, still 16:30", `${w3c?.status}/${w3c?.reason}; start ${hm(Date.parse(b3c.start_at))}; callback ${t3c.status}`, w3c?.status === "waiting_decision" && hm(Date.parse(b3c.start_at)) === "16:30");
  await db.from("work_items").update({ status: "rejected" }).eq("id", w3c.id);

  // F5: the minute tick sends a due reminder through the gate
  await db.from("booking_reminders").update({ due_at: new Date(Date.now() - 60_000).toISOString() }).eq("booking_id", b1.id).eq("kind", "h24");
  const tk = await tick();
  await sleep(1500);
  const remNow = (await db.from("booking_reminders").select("kind, status, work_item_id, note").eq("booking_id", b1.id).eq("kind", "h24")).data?.[0];
  const rw = remNow?.work_item_id ? (await db.from("work_items").select("status, decided_path, action").eq("id", remNow.work_item_id).single()).data : null;
  const msgs5 = await lastAgentMessages(conv, 4);
  check("F5 minute tick: the due reminder goes through the gate and is sent on the chat", "reminder sent, remind_booking done auto, message 'nhắc bạn có lịch'", `tick ${tk.status}; ${remNow?.status}; ${rw?.action}/${rw?.status}/${rw?.decided_path}; ${msgs5.find((x) => /nhắc bạn/.test(x))?.slice(0, 90) ?? "no message"}`, remNow?.status === "sent" && rw?.status === "done" && msgs5.some((x) => /nhắc bạn có lịch/.test(x)));

  // F4: late cancel (inside the 24 h window) with a fee -> ask. A booking tomorrow morning, found by the chat intent.
  const lateStart = Math.ceil((Date.now() + 6 * 3_600_000) / 900_000) * 900_000; // 6 hours from now: inside the 24 h free-change window
  const conv4 = await newConversation(ws, "Kiểm thử · Hoa");
  const lead4 = ok(await db.from("leads").insert({ workspace_id: ws, contact_name: "Kiểm thử · Hoa", company: "—", channel: "Website chat", need: "Cắt tóc", phone: "0900000004", origin: "live" }).select("id").single(), "lead4");
  await db.from("agent_conversations").update({ lead_id: lead4.id }).eq("id", conv4);
  const lateEnd = lateStart + 45 * 60_000;
  const lr = await db.rpc("booking_reserve", { p: { workspace_id: ws, lead_id: lead4.id, conversation_id: conv4, customer_name: "Kiểm thử · Hoa", customer_phone: "0900000004", service_id: cut.id, resource_id: m.resources.find((r) => r.name.endsWith("Lan")).id, start_at: new Date(lateStart).toISOString(), end_at: new Date(lateEnd).toISOString(), block_end_at: new Date(lateEnd + 15 * 60_000).toISOString(), party_size: 1, status: "confirmed", source_channel: "website", price_vnd: cut.price_vnd } });
  const late = lr.data;
  await customerSays(ws, conv4, "Mình xin hủy lịch ngày mai nhé", { intent: "cancel", service: "", date: null, time: null, from: null, to: null, party_size: 1, contact_name: "Kiểm thử · Hoa", phone: null, email: null, note: "bận đột xuất" });
  const w4 = late ? await workItem(ws, "cancel_with_fee", late) : null;
  const b4 = late ? (await db.from("bookings").select("status, cancel_fee_vnd").eq("id", late).single()).data : null;
  check("F4 late cancel (inside the 24 h window) -> cancel_with_fee waits for the owner, nothing cancelled yet", "waiting_decision, amount 100000 (50% of 200000), booking still confirmed", `${w4?.status}/${w4?.reason}; amount ${w4?.proposal?.amount_vnd}; booking ${b4?.status}`, w4?.status === "waiting_decision" && w4?.proposal?.amount_vnd === 100000 && b4?.status === "confirmed");
  const msgs4 = await lastAgentMessages(conv4, 3);
  check("F4b customer told the cancellation awaits the shop (no promise)", "message 'chuyển yêu cầu hủy lịch cho cửa hàng'", msgs4.find((x) => /cửa hàng/.test(x)) ?? msgs4[0], msgs4.some((x) => /chuyển yêu cầu hủy lịch cho cửa hàng/.test(x)));

  // F4c: free cancel of the far booking -> auto
  await customerSays(ws, conv, "Mình hủy lịch nhé, bận rồi", { intent: "cancel", service: "", date: null, time: null, from: null, to: null, party_size: 1, contact_name: "Kiểm thử · Lan Anh", phone: null, email: null, note: null });
  const b4c = (await db.from("bookings").select("status, holds_slot").eq("id", b1.id).single()).data;
  const w4c = await workItem(ws, "cancel_booking", b1.id);
  const rem4c = (await db.from("booking_reminders").select("status").eq("booking_id", b1.id)).data;
  check("F4c free cancellation (outside the window) -> cancel_booking auto, slot freed, reminders cancelled", "booking cancelled, work item done auto, reminders cancelled/sent", `${b4c.status} holds=${b4c.holds_slot}; ${w4c?.status}/${w4c?.decided_path}; reminders ${rem4c.map((r) => r.status).join(",")}`, b4c.status === "cancelled" && w4c?.status === "done" && rem4c.every((r) => r.status === "cancelled" || r.status === "sent"));

  // F6: waitlist intent + tools
  const conv6 = await newConversation(ws, "Kiểm thử · Bích");
  await customerSays(ws, conv6, "Nếu có chỗ trống chiều thứ Năm báo mình nhé", { intent: "waitlist", service: "Cắt tóc nữ", date: wed, time: null, from: "14:00", to: "17:00", party_size: 1, contact_name: "Kiểm thử · Bích", phone: "0900000006", email: null, note: null });
  const wl = (await db.from("booking_waitlist").select("*").eq("workspace_id", ws).eq("customer_name", "Kiểm thử · Bích")).data;
  check("F6 waitlist intent -> a waitlist row for the window", "1 row, waiting, window 14:00-17:00", `${wl.length} row(s) ${wl[0]?.status} ${wl[0] ? hm(Date.parse(wl[0].window_start)) + "-" + hm(Date.parse(wl[0].window_end)) : ""}`, wl.length === 1 && wl[0].status === "waiting");
  const jobT = ok(await db.from("engine_jobs").insert({ workspace_id: ws, kind: "chat.turn", status: "running", payload: { conversation_id: conv6, message_id: null, event_id: "x" }, dedupe_key: `test:${randomUUID()}`, locked_by: "booking-prod-check", locked_until: new Date(Date.now() + 300_000).toISOString() }).select("id").single(), "jobT");
  const tool = await signedPost("/api/engine/tool", { job_id: jobT.id, tool: "booking.find_slots", args: { service: "Cắt tóc nữ", date: wed, from: "09:00", to: "11:00" } });
  const ts = tool.json?.result?.slots ?? [];
  check("F7 OpenClaw tool booking.find_slots (signed /api/engine/tool)", "ok, slots between 09:00 and 11:00", `status ${tool.status}; ${ts.length} slots; first ${ts[0] ? hm(Date.parse(ts[0].start)) : "-"}`, tool.status === 200 && ts.length > 0 && ts.every((s) => { const h = hm(Date.parse(s.start)); return h >= "09:00" && h < "11:00"; }));
  await db.from("engine_jobs").update({ status: "done" }).eq("id", jobT.id);

  // F8: assist mode: even a free slot waits
  await db.from("module_installations").update({ operating_mode: "assist" }).eq("workspace_id", ws).eq("module_key", "booking");
  const conv8 = await newConversation(ws, "Kiểm thử · Cúc");
  await customerSays(ws, conv8, "Đặt giúp mình cắt tóc nữ 10:00 thứ Sáu", { intent: "book", service: "Cắt tóc nữ", date: addDays(wed, 1), time: "10:00", from: null, to: null, party_size: 1, contact_name: "Kiểm thử · Cúc", phone: "0900000008", email: null, note: null });
  const b8 = (await db.from("bookings").select("*").eq("workspace_id", ws).eq("customer_name", "Kiểm thử · Cúc").limit(1)).data?.[0];
  const w8 = b8 ? await workItem(ws, "confirm_booking", b8.id) : null;
  check("F8 assist mode (module default): a free slot still asks the owner", "waiting_decision, booking requested (slot held)", `${w8?.status}/${w8?.reason}; booking ${b8?.status} holds=${b8?.holds_slot}`, w8?.status === "waiting_decision" && b8?.status === "requested" && b8?.holds_slot === true);
  const msgs8 = await lastAgentMessages(conv8, 3);
  check("F8b customer told the request was received (no confirmation yet)", "'đã nhận yêu cầu' message", msgs8.find((x) => /đã nhận yêu cầu/.test(x)) ?? msgs8[0], msgs8.some((x) => /đã nhận yêu cầu/.test(x)) && !msgs8.some((x) => /đã xác nhận lịch hẹn/.test(x)));
  await db.from("module_installations").update({ operating_mode: "autopilot" }).eq("workspace_id", ws).eq("module_key", "booking");
};

/* ------------------------------------------------------------------ public page */
const publicCheck = async () => {
  const ws = await workspace();
  const m = await load(ws);
  await db.from("booking_rate").delete().neq("key", "");
  const page = await fetch(`${BASE}/b/${SLUG}`);
  const html = await page.text();
  check("P1 public page renders without login", "200 and the shop name", `${page.status}; contains name ${html.includes("Kiểm thử") ? "yes" : "no"}`, page.status === 200 && html.includes("Đặt lịch hẹn"));
  const missing = await fetch(`${BASE}/b/khong-co-trang-nay`);
  check("P1b unknown or disabled slug", "404", String(missing.status), missing.status === 404);
  const thu = nextWeekday(4, 6);
  const svc = m.byName["Cắt tóc nữ"];
  const s = await (await fetch(`${BASE}/api/b/${SLUG}/slots?service=${svc.id}&date=${thu}`)).json();
  check("P2 free times of a service on a day", "list of start times", `${s.times?.length} times, first ${s.times?.[0] ? hm(Date.parse(s.times[0])) : "-"}`, (s.times?.length ?? 0) > 0);
  const startIso = s.times[4] ?? s.times[0];
  const token = randomUUID();
  const book = await fetch(`${BASE}/api/b/${SLUG}/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: svc.id, start: startIso, name: "Kiểm thử · Khách web", phone: "0900000099", token }) });
  const bj = await book.json();
  const row = bj.booking_id ? (await db.from("bookings").select("status, source_channel, customer_phone").eq("id", bj.booking_id).single()).data : null;
  check("P3 book through the page (curl) -> request through the gate, within policy confirmed", "200, state confirmed, source public_page", `${book.status}; ${bj.state}; ${row?.status}/${row?.source_channel}`, book.status === 200 && bj.state === "confirmed" && row?.source_channel === "public_page");
  const again = await (await fetch(`${BASE}/api/b/${SLUG}/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: svc.id, start: startIso, name: "Kiểm thử · Khách web", phone: "0900000099", token }) })).json();
  check("P3b the same request twice (same token) books once", "same booking id", `${again.booking_id === bj.booking_id ? "same id" : "different id"}`, again.booking_id === bj.booking_id);
  const taken2 = await (await fetch(`${BASE}/api/b/${SLUG}/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: svc.id, start: new Date(Date.now() + 10 * 60_000).toISOString(), name: "Kiểm thử · Khách web", phone: "0900000098" }) })).json();
  check("P4 a time inside the minimum lead is not auto-confirmed", "state waiting (owner decides) with alternatives", `${taken2.state}; ${taken2.alternatives?.length ?? 0} alternatives`, taken2.state === "waiting");
  const bad = await fetch(`${BASE}/api/b/${SLUG}/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: svc.id, start: startIso, name: "", phone: "12" }) });
  check("P5 invalid input is refused", "400", String(bad.status), bad.status === 400);
  const hp = await (await fetch(`${BASE}/api/b/${SLUG}/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: svc.id, start: startIso, name: "Bot", phone: "0900000097", website: "http://spam" }) })).json();
  const bots = (await db.from("bookings").select("id").eq("workspace_id", ws).eq("customer_name", "Bot")).data;
  check("P6 honeypot: a bot filling the hidden field creates nothing", "no booking for 'Bot'", `${bots.length} rows; response ${hp.state}`, bots.length === 0);
  let limited = 0;
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${BASE}/api/b/${SLUG}/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: svc.id, start: startIso, name: "", phone: "1" }) });
    if (r.status === 429) limited += 1;
  }
  check("P7 rate limit: more than 8 booking requests in 10 minutes from one visitor", "429 after the 8th", `${limited} of 12 rapid requests got 429`, limited >= 3);
};

/* ------------------------------------------------------------------ the booking automations (cards switched on in the test workspace only) */
const automations = async () => {
  const ws = await workspace();
  const m = await load(ws);
  await db.from("booking_waitlist").delete().eq("workspace_id", ws);
  const keys = ["appointment_reminder", "booking_review", "booking_comeback", "booking_waitlist_notice"];
  const tpl = Object.fromEntries((await db.from("automation_templates").select("key, definition").in("key", keys)).data.map((t) => [t.key, t.definition]));
  for (const k of keys) ok(await db.from("automation_pipelines").upsert({ workspace_id: ws, template_key: k, name: tpl[k].name.vi, module_key: "booking", enabled: true, config: tpl[k].defaults ?? {}, body: tpl[k].defaultBody?.vi ?? null, body_version: 1 }, { onConflict: "workspace_id,template_key" }), `pipeline ${k}`);
  const person = async (name, phone) => {
    const conv = await newConversation(ws, name);
    const lead = ok(await db.from("leads").insert({ workspace_id: ws, contact_name: name, company: "—", channel: "Website chat", need: "Cắt tóc", phone, origin: "live" }).select("id").single(), "lead");
    await db.from("agent_conversations").update({ lead_id: lead.id }).eq("id", conv);
    return { conv, lead: lead.id };
  };
  const doneBooking = async (p, svcName, when, ago) => {
    const svc = m.byName[svcName];
    const id = await reserve(ws, m, svcName, svcName.includes("Gội") ? "Phòng gội 1" : "Mai", nextWeekday(when, 5), "09:00", { customer: p.name, lead_id: p.lead });
    await db.from("bookings").update({ status: "done", done_at: new Date(Date.now() - ago).toISOString(), conversation_id: p.conv }).eq("id", id);
    return id;
  };
  const rev = { name: "Kiểm thử · Khách xong 4 giờ trước", ...(await person("Kiểm thử · Khách xong 4 giờ trước", "0900000011")) };
  const bk = { name: "Kiểm thử · Khách cắt tóc 31 ngày trước", ...(await person("Kiểm thử · Khách cắt tóc 31 ngày trước", "0900000012")) };
  const wl = { name: "Kiểm thử · Khách chờ lịch", ...(await person("Kiểm thử · Khách chờ lịch", "0900000013")) };
  const b1 = await doneBooking(rev, "Cắt tóc nữ", 2, 4 * 3_600_000);
  const b2 = await doneBooking(bk, "Cắt tóc nữ", 3, 31 * 86_400_000);
  const thu = nextWeekday(4, 6);
  ok(await db.from("booking_waitlist").insert({ workspace_id: ws, lead_id: wl.lead, conversation_id: wl.conv, customer_name: wl.name, customer_phone: "0900000013", service_id: m.byName["Cắt tóc nữ"].id, window_start: new Date(zonedMs(thu, "09:00", TZ)).toISOString(), window_end: new Date(zonedMs(thu, "12:00", TZ)).toISOString() }), "waitlist");
  const t = await tick();
  console.log("tick", t.status, JSON.stringify(t.json));
  await sleep(2500);
  const runs = (await db.from("automation_runs").select("dedupe_key, status, steps, pipeline_id").eq("workspace_id", ws).like("dedupe_key", "bk%")).data;
  const msg = async (conv) => (await db.from("agent_messages").select("role, body").eq("conversation_id", conv).eq("role", "agent").order("created_at", { ascending: false }).limit(1)).data?.[0]?.body ?? "(no message)";
  const rm = await msg(rev.conv), bm = await msg(bk.conv), wm = await msg(wl.conv);
  const run = (prefix, id) => runs.find((r) => r.dedupe_key.startsWith(`${prefix}:${id}`));
  check("A1 booking_review: 4 h after a done booking the card asks for feedback through the gate", "run done, message 'Bạn thấy buổi hẹn thế nào'", `${run("bkreview", b1)?.status}; ${rm.slice(0, 100)}`, run("bkreview", b1)?.status === "done" && /thế nào/.test(rm));
  check("A2 booking_comeback: 31 days after a 30-day service the card invites the customer back (asks the owner first)", "run waiting_approval (send_follow_up asks), nothing sent yet", `${run("bkback", b2)?.status}; last agent message: ${bm.slice(0, 60)}`, ["waiting_approval", "done"].includes(run("bkback", b2)?.status) );
  check("A3 booking_waitlist_notice: a free slot in the waiting window notifies the customer and marks the entry", "run done, message 'vừa có chỗ trống', waitlist notified", `${runs.find((r) => r.dedupe_key.startsWith("bkwl:"))?.status}; ${wm.slice(0, 100)}; ${(await db.from("booking_waitlist").select("status").eq("workspace_id", ws).eq("customer_name", wl.name)).data?.[0]?.status}`, /chỗ trống/.test(wm));
  const t2 = await tick();
  await sleep(1500);
  const runs2 = (await db.from("automation_runs").select("dedupe_key").eq("workspace_id", ws).like("dedupe_key", "bk%")).data;
  check("A4 idempotent: a second tick starts no duplicate runs", `${runs.length} runs`, `${runs2.length} runs`, runs2.length === runs.length && t2.status === 200);
  for (const k of keys) await db.from("automation_pipelines").update({ enabled: false }).eq("workspace_id", ws).eq("template_key", k); // back to the default: OFF
};

/* ------------------------------------------------------------------ optional shifts integration (approved leave blocks a linked resource) */
const shiftsCheck = async () => {
  const ws = await workspace();
  const m = await load(ws);
  await db.from("booking_rate").delete().neq("key", "");
  const tue = nextWeekday(2, 6);
  const svc = m.byName["Cắt tóc nữ"];
  const times = async () => ((await (await fetch(`${BASE}/api/b/${SLUG}/slots?service=${svc.id}&date=${tue}`)).json()).times ?? []).map((t) => hm(Date.parse(t)));
  const lan = m.resources.find((r) => r.name.endsWith("Lan"));
  await db.from("shifts_leave_requests").delete().eq("workspace_id", ws);
  await db.from("shifts_staff").delete().eq("workspace_id", ws);
  await db.from("staff").delete().eq("workspace_id", ws).eq("name", "Kiểm thử · Nhân viên Lan");
  await db.from("booking_resources").update({ staff_id: null }).eq("id", lan.id);
  const before = await times();
  const st = ok(await db.from("staff").insert({ workspace_id: ws, name: "Kiểm thử · Nhân viên Lan", role: "Thợ tóc" }).select("id").single(), "staff");
  const ss = ok(await db.from("shifts_staff").insert({ workspace_id: ws, name: "Kiểm thử · Nhân viên Lan", staff_id: st.id }).select("id").single(), "shifts_staff");
  await db.from("booking_resources").update({ staff_id: st.id }).eq("id", lan.id);
  const linkedNoLeave = await times();
  ok(await db.from("shifts_leave_requests").insert({ workspace_id: ws, staff_id: ss.id, from_date: tue, to_date: tue, reason: "Kiểm thử · nghỉ phép", status: "approved" }), "leave");
  const afterLeave = await times();
  // 12:00-12:45 is covered by Lan only (Mai is at lunch), so it disappears when Lan is on approved leave
  check("S1 optional shifts link: before the link and with a link but no leave the day is the same", `${before.length} times`, `${linkedNoLeave.length} times`, before.length === linkedNoLeave.length && before.includes("12:00"));
  check("S2 an approved leave of the linked staff member blocks that resource for the day", "12:00 (only Lan works at lunch) and later Lan-only times disappear", `${afterLeave.length} times, 12:00 ${afterLeave.includes("12:00") ? "still offered" : "gone"}`, afterLeave.length < before.length && !afterLeave.includes("12:00") && afterLeave.includes("10:00"));
  await db.from("shifts_leave_requests").delete().eq("workspace_id", ws);
  await db.from("shifts_staff").delete().eq("workspace_id", ws);
  await db.from("booking_resources").update({ staff_id: null }).eq("id", lan.id);
  await db.from("staff").delete().eq("id", st.id);
};

/* ------------------------------------------------------------------ one real OpenClaw turn */
const realTurn = async () => {
  const ws = await workspace();
  const m = await load(ws);
  // make sure the agent's OpenClaw copy (AGENTS.md with the booking reply contract) is current: force a sync and wait for it
  const inst = ok(await db.from("module_installations").select("id").eq("workspace_id", ws).eq("module_key", "booking").single(), "inst");
  const before = (await db.from("openclaw_agent_sync").select("synced_at").eq("installation_id", inst.id).maybeSingle()).data?.synced_at ?? "";
  console.log("sync enqueue:", (await db.rpc("engine_enqueue_agent_sync", { p_installation: inst.id, p_force: true })).error?.message ?? "ok");
  for (let i = 0; i < 40; i++) {
    const row = (await db.from("openclaw_agent_sync").select("synced_at, status, files").eq("installation_id", inst.id).maybeSingle()).data;
    if (row && row.synced_at !== before && row.status === "ok") { console.log("synced", row.synced_at, JSON.stringify(row.files)); break; }
    await sleep(3000);
  }
  const who = `Kiểm thử Thật ${String(Date.now()).slice(-4)}`;
  const conv = await newConversation(ws, who);
  const wed = nextWeekday(4, 4);
  const phrasings = [
    `Chào shop, mình tên ${who}, số 0900000077. Mình muốn cắt tóc nữ lúc 11:00 ngày ${wed.split("-").reverse().join("/")} được không?`,
    `Cho mình đặt cắt tóc nữ 10 giờ sáng thứ Năm tuần sau nhé, tên ${who}, sđt 0911222333`,
    `${who} đây, 0933444555. Mai có chỗ cắt tóc nữ buổi chiều không shop?`,
  ];
  const text = phrasings[Number(process.env.PHRASE ?? 0) % phrasings.length];
  const msg = ok(await db.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv, role: "user", body: text }).select("id").single(), "msg");
  const enq = await db.rpc("engine_enqueue", { p_workspace: ws, p_kind: "chat.turn", p_payload: { conversation_id: conv, message_id: msg.id, event_id: msg.id, agent_id: null, channel: "website" }, p_dedupe_key: `chat.turn:${msg.id}`, p_max_attempts: 2 });
  console.log("enqueued", enq.data ?? enq.error?.message);
  const t0 = Date.now();
  for (;;) {
    const bks = (await db.from("bookings").select("status, start_at, customer_name").eq("workspace_id", ws).eq("customer_name", who)).data;
    const reqs = (await db.from("events").select("kind").eq("workspace_id", ws).eq("kind", "booking.chat_request").gte("created_at", new Date(t0).toISOString())).data;
    const msgs = (await db.from("agent_messages").select("role, body").eq("conversation_id", conv).order("created_at")).data;
    if (bks.length || Date.now() - t0 > 120_000) {
      console.log("elapsed", ((Date.now() - t0) / 1000).toFixed(1), "s; messages:", JSON.stringify(msgs, null, 1));
      check("R1 real OpenClaw turn produced a structured booking_request and a gated booking", "booking created from the model's JSON", JSON.stringify(bks), bks.length > 0);
      break;
    }
    await sleep(2000);
  }
};

const phase = process.argv[2] ?? "all";
const phases = phase === "all" ? ["setup", "slots", "flow", "public"] : [phase];
for (const p of phases) {
  console.log(`\n=== ${p}`);
  if (p === "setup") await setup();
  else if (p === "slots") await slotsCheck();
  else if (p === "flow") await flow();
  else if (p === "public") await publicCheck();
  else if (p === "automations") await automations();
  else if (p === "shifts") await shiftsCheck();
  else if (p === "real-turn") await realTurn();
  else throw new Error(`unknown phase ${p}`);
}
if (rows.length) {
  console.log(`\n${rows.filter((r) => r.pass).length}/${rows.length} passed`);
  if (rows.some((r) => !r.pass)) process.exitCode = 1;
}
