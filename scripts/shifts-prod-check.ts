// Production check of the shifts module, through the app's own code (src/lib/*, the same functions the workbench and the tick call), against the
// production database with the service role. Clearly named test data only, in the workspace "Kiểm thử · Quán cà phê".
//   NIVO_SECRETS=... node scripts/with-secrets.mjs node --experimental-transform-types --import ./scripts/ts-loader.mjs scripts/shifts-prod-check.ts [--tick-only]
// Prints a table: step, result, ms. Never prints secrets.
import { createClient } from "@supabase/supabase-js";
import { installModuleCore } from "@/lib/module-install";
import { resumeWork, type EngineCtx } from "@/lib/engine";
import { explainSchedule, proposeWeek, requestLeaveWork, requestPublish, requestSwapWork } from "@/lib/module-shifts-core";
import { parseImport, POSITION_COLORS, fold } from "@/lib/module-shifts-import";
import { closeMonth, runShiftsTick } from "@/lib/module-shifts-tick";
import { addDays, instantOf, mondayOf, todayVn, toMin, clockVn, fromMin } from "@/lib/module-shifts-types";
import { swapFindings } from "@/lib/module-shifts-rules";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const NAME = "Kiểm thử · Quán cà phê";
const rows: Array<{ step: string; result: string; ms: number }> = [];
const step = async <T>(name: string, fn: () => Promise<{ out: T; note: string }>): Promise<T> => {
  const t0 = Date.now();
  try {
    const { out, note } = await fn();
    rows.push({ step: name, result: note, ms: Date.now() - t0 });
    return out;
  } catch (e) {
    rows.push({ step: name, result: `FAILED: ${e instanceof Error ? e.message : String(e)}`, ms: Date.now() - t0 });
    throw e;
  }
};
const ok = <T,>(r: { data: T | null; error: { message: string } | null }, what: string): T => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data as T; };

try {
  /* ---------------------------------------------------------------- workspace + install */
  const ws = await step("workspace", async () => {
    let id = ((await db.from("workspaces").select("id").eq("name", NAME).limit(1)).data ?? [])[0]?.id as string | undefined;
    let note = "found";
    if (!id) {
      const ref = ok(await db.from("workspaces").select("owner_id").eq("id", "a6f076a7-de08-4d20-bba5-5f6cdd791b6a").single(), "ref workspace");
      id = ok(await db.from("workspaces").insert({ name: NAME, owner_id: (ref as { owner_id: string }).owner_id }).select("id").single(), "workspace").id as string;
      note = "created";
    }
    const mem = await db.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", id);
    if ((mem.count ?? 0) === 0) {
      const ref = ok(await db.from("workspaces").select("owner_id").eq("id", id).single(), "owner") as { owner_id: string };
      ok(await db.from("workspace_members").insert({ workspace_id: id, user_id: ref.owner_id, role: "owner", display_name: "Chủ quán (kiểm thử)", status: "active" }).select("id").single(), "member");
      note += ", owner member added";
    }
    return { out: id, note: `${note} ${id.slice(0, 8)}` };
  });
  const c: EngineCtx = { db, ws, actor: "Kiểm thử", locale: "vi" };
  const owner = { name: "Chủ quán (kiểm thử)", kind: "owner" as const };

  await step("install module + authority rules", async () => {
    const r = await installModuleCore(db, { workspaceId: ws, moduleKey: "shifts", locale: "vi", actorName: "Kiểm thử" });
    // The test shop runs in autopilot so the "auto" rule of approve_swap really applies (assist mode asks for everything).
    await db.from("module_installations").update({ operating_mode: "autopilot" }).eq("workspace_id", ws).eq("module_key", "shifts");
    const rules = ((await db.from("authority_rules").select("action, mode").eq("workspace_id", ws).in("action", ["publish_schedule", "approve_swap", "approve_leave", "remind_shift"])).data ?? []) as Array<{ action: string; mode: string }>;
    return { out: r, note: `installed=${r.created ? "new" : "existing"}, autopilot, rules ${rules.map((x) => `${x.action}:${x.mode}`).join(" ")}` };
  });

  /* ---------------------------------------------------------------- café data */
  await step("seed café: 3 positions, 6 staff, coverage 7 days, availability", async () => {
    const have = ((await db.from("shifts_positions").select("id").eq("workspace_id", ws)).data ?? []).length;
    if (have) return { out: null, note: "already seeded" };
    const parsed = parseImport({
      positions: "Pha chế\nPhục vụ\nThu ngân",
      staff: [
        "Kiểm thử An; pha chế, phục vụ; 30k; 48",
        "Kiểm thử Bình; phục vụ, thu ngân; 25k; 44",
        "Kiểm thử Chi; pha chế; 32k; 40",
        "Kiểm thử Dũng; phục vụ, thu ngân; 24k; 40",
        "Kiểm thử Em; thu ngân, phục vụ; 26k; 24",
        "Kiểm thử Giang; pha chế, thu ngân; 28k; 36",
      ].join("\n"),
      coverage: [
        "mọi ngày 07:00-12:00 Pha chế 1",
        "mọi ngày 12:00-21:00 Pha chế 1",
        "T7-CN 17:00-21:00 Pha chế 1-2 cao điểm",
        "mọi ngày 09:00-12:00 Phục vụ 1",
        "mọi ngày 12:00-14:00 Phục vụ 1-2 cao điểm",
        "mọi ngày 14:00-21:00 Phục vụ 1",
        "mọi ngày 09:00-17:00 Thu ngân 1",
      ].join("\n"),
    });
    if (parsed.errors.length) throw new Error(parsed.errors.join(" "));
    const pos = ok(await db.from("shifts_positions").insert(parsed.positions.map((name, i) => ({ workspace_id: ws, name, color: POSITION_COLORS[i], sort_order: i }))).select("id, name"), "positions") as Array<{ id: string; name: string }>;
    const pid = new Map(pos.map((p) => [fold(p.name), p.id]));
    const staffIds = new Map<string, string>();
    for (const s of parsed.staff) {
      const officeRow = ok(await db.from("staff").insert({ workspace_id: ws, name: s.name, role: s.positions.join(", ") }).select("id").single(), "staff row") as { id: string };
      const row = ok(await db.from("shifts_staff").insert({ workspace_id: ws, name: s.name, staff_id: officeRow.id, position_ids: s.positions.map((p) => pid.get(fold(p))), ...(s.maxWeek ? { max_hours_week: s.maxWeek } : {}) }).select("id").single(), "shifts_staff") as { id: string };
      ok(await db.from("shifts_staff_pay").insert({ staff_id: row.id, workspace_id: ws, hourly_wage_vnd: s.wage }).select("staff_id").single(), "pay");
      staffIds.set(s.name, row.id);
    }
    ok(await db.from("shifts_coverage").insert(parsed.blocks.map((b) => ({ workspace_id: ws, weekday: b.weekday, start_time: b.start, end_time: b.end, position_id: pid.get(fold(b.position)), min_staff: b.min, ideal_staff: b.ideal, is_peak: b.peak }))).select("id"), "coverage");
    const av = (name: string, weekday: number, available: boolean, start = "00:00", end = "23:59", note = "") => ({ workspace_id: ws, staff_id: staffIds.get(name), weekday, start_time: start, end_time: end, available, note, status: "approved" });
    ok(await db.from("shifts_availability").insert([
      av("Kiểm thử An", 5, false, "00:00", "23:59", "Thứ 7 bận học"), av("Kiểm thử Chi", 0, false, "00:00", "23:59", "Thứ 2 nghỉ cố định"), av("Kiểm thử Giang", 6, false, "00:00", "23:59", "Chủ nhật bận"),
      av("Kiểm thử Em", 1, true, "13:00", "21:00", "Thứ 3 chỉ làm chiều"), av("Kiểm thử Bình", 2, false, "00:00", "12:00", "Thứ 4 bận buổi sáng"), av("Kiểm thử Dũng", 4, true, "12:00", "22:00", "Thứ 6 làm từ trưa"),
    ]).select("id"), "availability");
    ok(await db.from("shifts_settings").upsert({ workspace_id: ws, opening_hours: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), { open: "07:00", close: "21:00" }])) }, { onConflict: "workspace_id" }).select("workspace_id"), "settings");
    return { out: null, note: `${pos.length} positions, ${parsed.staff.length} staff, ${parsed.blocks.length} coverage blocks (7 days), 6 availability rules` };
  });

  const monday = mondayOf(addDays(todayVn(), 3 + 7 * Number(process.env.WEEK_OFFSET ?? 0))); // the next Monday, so notice rules (24h) hold
  /* ---------------------------------------------------------------- solver */
  const prop = await step(`solver proposal for week ${monday}`, async () => {
    const p = await proposeWeek(c, monday, "Kiểm thử");
    return { out: p, note: `v${p.version}: ${p.shiftCount} shifts, ${p.openCount} open, ${p.shortages} short blocks, cost ${p.costVnd}đ, solver ${p.ms} ms (${p.iterations} starts)` };
  });
  rows.push({ step: "  solver timing (stored on the schedule)", result: `${prop.ms} ms`, ms: prop.ms });

  await step("OpenClaw explanation", async () => {
    const x = await explainSchedule(c, prop.scheduleId);
    return { out: x, note: `${x.source} in ${x.ms} ms: ${x.text.replace(/\s+/g, " ").slice(0, 160)}…` };
  });

  /* ---------------------------------------------------------------- gate: publish */
  const item = await step("publish_schedule goes to the gate (rule = ask)", async () => {
    const it = await requestPublish(c, prop.scheduleId);
    return { out: it, note: `work item ${it.id.slice(0, 8)} status=${it.status}; ${it.proposal.summary}` };
  });
  await step("owner approves in the gate → performer publishes", async () => {
    const done = await resumeWork(c, item.id, "approved", {}, owner);
    const sched = ok(await db.from("shifts_schedules").select("status, published_at").eq("id", prop.scheduleId).single(), "schedule") as { status: string; published_at: string };
    const notes = await db.from("shifts_notifications").select("id, channel, kind", { count: "exact" }).eq("workspace_id", ws).eq("schedule_id", prop.scheduleId).eq("kind", "publish");
    const jobs = await db.from("engine_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("kind", "shifts.remind").eq("status", "queued");
    const noshow = await db.from("engine_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("kind", "shifts.noshow").eq("status", "queued");
    return { out: done, note: `item ${done.status}; schedule ${sched.status}; publish notifications ${notes.count} (${[...new Set((notes.data ?? []).map((n: { channel: string }) => n.channel))].join("/")}); reminder jobs queued ${jobs.count}, no-show jobs ${noshow.count}; ${done.result?.summary ?? ""}` };
  });
  await step("Office carries each person's week (messages)", async () => {
    const m = await db.from("messages").select("id", { count: "exact", head: true }).eq("workspace_id", ws).ilike("body", "%Lịch làm tuần%");
    return { out: null, note: `${m.count} Office messages with the weekly schedule` };
  });

  /* ---------------------------------------------------------------- swap (auto) and leave (waiting) */
  const shifts = ((await db.from("shifts_shifts").select("*").eq("schedule_id", prop.scheduleId).eq("status", "published").not("staff_id", "is", null)).data ?? []) as Array<Record<string, string>>;
  // The week is full (everyone is close to their limits), so the in-rules swap goes to a part-timer who joined after the draft was made.
  if (!((await db.from("shifts_staff").select("id").eq("workspace_id", ws).eq("name", "Kiểm thử Hà (mới vào)")).data ?? []).length) {
    const posIds = ((await db.from("shifts_positions").select("id, name").eq("workspace_id", ws)).data ?? []) as Array<{ id: string; name: string }>;
    const officeRow = ok(await db.from("staff").insert({ workspace_id: ws, name: "Kiểm thử Hà (mới vào)", role: "phục vụ, pha chế" }).select("id").single(), "staff row") as { id: string };
    const ha = ok(await db.from("shifts_staff").insert({ workspace_id: ws, name: "Kiểm thử Hà (mới vào)", staff_id: officeRow.id, position_ids: posIds.filter((p) => p.name !== "Thu ngân").map((p) => p.id), max_hours_week: 20 }).select("id").single(), "ha") as { id: string };
    ok(await db.from("shifts_staff_pay").insert({ staff_id: ha.id, workspace_id: ws, hourly_wage_vnd: 22000 }).select("staff_id").single(), "pay");
  }
  // The part-timer agreed to extra hours this week, so a swap to her can stay inside the rules.
  await db.from("shifts_staff").update({ max_hours_week: 60, max_hours_day: 14, min_rest_hours: 8 }).eq("workspace_id", ws).eq("name", "Kiểm thử Hà (mới vào)");
  const staff = ((await db.from("shifts_staff").select("id, name, position_ids").eq("workspace_id", ws).order("created_at")).data ?? []) as Array<{ id: string; name: string; position_ids: string[] }>;
  // Find a swap that is inside the rules: same position, no rule broken for the receiver.
  let pick: { shift: Record<string, string>; to: string } | null = null;
  for (const s of shifts) {
    for (const p of staff) {
      if (p.id === s.staff_id || !p.position_ids.includes(s.position_id)) continue;
      const f = await swapFindings(db, ws, { kind: "swap", shiftId: s.id, fromStaffId: s.staff_id, toStaffId: p.id });
      if (!f.reasons.length) { pick = { shift: s, to: p.id }; break; }
    }
    if (pick) break;
  }
  if (!pick) throw new Error("no in-rules swap found in this schedule");
  const swapId = ok(await db.from("shifts_swap_requests").insert({ workspace_id: ws, kind: "swap", shift_id: pick.shift.id, from_staff_id: pick.shift.staff_id, to_staff_id: pick.to, reason: "Kiểm thử: đổi ca trong quy tắc", status: "pending" }).select("id").single(), "swap") as { id: string };
  await step("swap request inside the rules → approve_swap auto", async () => {
    const it = await requestSwapWork(c, swapId.id, { kind: "swap", shiftId: pick!.shift.id, fromStaffId: pick!.shift.staff_id, toStaffId: pick!.to });
    const sh = ok(await db.from("shifts_shifts").select("staff_id, status").eq("id", pick!.shift.id).single(), "shift") as { staff_id: string; status: string };
    const sw = ok(await db.from("shifts_swap_requests").select("status, decided_by").eq("id", swapId.id).single(), "swap") as { status: string; decided_by: string };
    return { out: it, note: `item ${it.status}/${it.decided_path}; request ${sw.status} by ${sw.decided_by}; shift now ${sh.status}, reassigned=${sh.staff_id === pick!.to}` };
  });
  // A swap outside the rules (a person of another position) must wait for the owner.
  const wrong = staff.find((p) => !p.position_ids.includes(pick!.shift.position_id));
  if (wrong) {
    const sw2 = ok(await db.from("shifts_swap_requests").insert({ workspace_id: ws, kind: "swap", shift_id: pick.shift.id, from_staff_id: pick.to, to_staff_id: wrong.id, reason: "Kiểm thử: đổi ca ngoài quy tắc", status: "pending" }).select("id").single(), "swap2") as { id: string };
    await step("swap outside the rules (other position) → waits for owner", async () => {
      const it = await requestSwapWork(c, sw2.id, { kind: "swap", shiftId: pick!.shift.id, fromStaffId: pick!.to, toStaffId: wrong.id });
      return { out: it, note: `item ${it.status}; ${it.proposal.summary.slice(0, 150)}` };
    });
  }
  const leaver = staff[2];
  const leave = ok(await db.from("shifts_leave_requests").insert({ workspace_id: ws, staff_id: leaver.id, from_date: addDays(monday, 2), to_date: addDays(monday, 3), reason: "Kiểm thử: việc gia đình", status: "pending" }).select("id").single(), "leave") as { id: string };
  await step("leave request → approve_leave waits (rule = ask)", async () => {
    const it = await requestLeaveWork(c, leave.id);
    const l = ok(await db.from("shifts_leave_requests").select("status").eq("id", leave.id).single(), "leave") as { status: string };
    return { out: it, note: `item ${it.status}; request ${l.status}; ${it.proposal.summary}` };
  });

  /* ---------------------------------------------------------------- reminders and no-show (the tick) */
  await db.from("automation_pipelines").upsert({ workspace_id: ws, template_key: "shifts_shift_reminder", name: "Nhắc ca trước giờ", module_key: "shifts", enabled: true, config: { beforeMinutes: 60, noShowMinutes: 10 } }, { onConflict: "workspace_id,template_key" });
  const dueShift = shifts.find((s) => s.id !== pick!.shift.id)!;
  await step("reminder job: due now → tick runs remind_shift through the gate", async () => {
    await db.from("engine_jobs").update({ run_at: new Date(Date.now() - 60_000).toISOString() }).eq("workspace_id", ws).eq("kind", "shifts.remind").contains("payload", { shift_id: dueShift.id });
    const ran = await runShiftsTick(new Date());
    const wi = ((await db.from("work_items").select("status, decided_path, result").eq("workspace_id", ws).eq("action", "remind_shift").order("created_at", { ascending: false }).limit(1)).data ?? [])[0] as { status: string; decided_path: string; result: { summary: string } } | undefined;
    const n = await db.from("shifts_notifications").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("kind", "reminder");
    return { out: null, note: `tick handled ${ran}; remind_shift ${wi?.status}/${wi?.decided_path}: ${wi?.result?.summary ?? "-"}; reminder notifications ${n.count}` };
  });
  await step("no-show alert: 10 min after start, no check-in → owner alerted", async () => {
    const clock = clockVn();
    const start = Math.max(0, clock.minute - 15);
    const todayWeek = mondayOf(clock.date);
    let sched = ((await db.from("shifts_schedules").select("id").eq("workspace_id", ws).eq("week_start", todayWeek).eq("status", "published").limit(1)).data ?? [])[0] as { id: string } | undefined;
    if (!sched) sched = ok(await db.from("shifts_schedules").insert({ workspace_id: ws, week_start: todayWeek, version: 1, status: "published", source: "manual", published_at: new Date().toISOString(), created_by: "Kiểm thử" }).select("id").single(), "today schedule") as { id: string };
    const sh = ok(await db.from("shifts_shifts").insert({ workspace_id: ws, schedule_id: sched.id, shift_date: clock.date, start_time: fromMin(start), end_time: fromMin(Math.min(1439, start + 180)), position_id: staff[0].position_ids[0], staff_id: staff[0].id, status: "published", source: "manual", note: "Kiểm thử no-show" }).select("id").single(), "shift") as { id: string };
    ok(await db.rpc("engine_enqueue", { p_workspace: ws, p_kind: "shifts.noshow", p_payload: { shift_id: sh.id }, p_dedupe_key: `shifts.noshow:${sh.id}`, p_run_at: new Date(Date.now() - 1000).toISOString(), p_max_attempts: 3 }) as never, "enqueue");
    const ran = await runShiftsTick(new Date());
    const a = await db.from("shifts_notifications").select("body", { count: "exact" }).eq("workspace_id", ws).eq("shift_id", sh.id).eq("kind", "no_show");
    return { out: null, note: `tick handled ${ran}; alerts ${a.count}: ${(a.data?.[0] as { body: string } | undefined)?.body ?? "-"}` };
  });

  /* ---------------------------------------------------------------- monthly close */
  await step("monthly close (hours x wage → Office + evidence + CSV mail when possible)", async () => {
    const month = monday.slice(0, 7);
    const r = await closeMonth(ws, month, { force: true, noEmail: true });
    return { out: null, note: `done=${r.done}, emailed=${r.emailed}, total ${r.total}đ for ${month}` };
  });
  void instantOf; void toMin;
} catch (e) {
  console.error("CHECK STOPPED:", e instanceof Error ? e.message : e);
}
console.log("\n| Step | Result | ms |\n|---|---|---|");
for (const r of rows) console.log(`| ${r.step} | ${r.result.replace(/\|/g, "/")} | ${r.ms} |`);
