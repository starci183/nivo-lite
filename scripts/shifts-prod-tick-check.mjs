#!/usr/bin/env node
// Checks that the PRODUCTION minute tick (pg_cron -> /api/automation/tick -> runShiftsTick) runs a due shifts.remind job by itself.
// Makes the reminder job of one future published shift of the test workspace "Kiểm thử · Quán cà phê" due, then polls until the job is done.
//   NIVO_SECRETS=... node scripts/with-secrets.mjs node scripts/shifts-prod-tick-check.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ws = (await db.from("workspaces").select("id").eq("name", "Kiểm thử · Quán cà phê").single()).data.id;
const marker = new Date(Date.now() - 60_000).toISOString();
const jobs = (await db.from("engine_jobs").select("id, status, run_at, payload").eq("workspace_id", ws).eq("kind", "shifts.remind").eq("status", "queued").gt("run_at", new Date().toISOString()).order("run_at").limit(200)).data;
let job = null;
let shift = null;
for (const j of jobs) {
  const s = (await db.from("shifts_shifts").select("id, shift_date, start_time, staff_id, status").eq("id", j.payload.shift_id).single()).data;
  if (s && s.staff_id && ["published", "swapped"].includes(s.status)) { job = j; shift = s; break; }
}
console.log("shift", shift.shift_date, shift.start_time, "job", job.id.slice(0, 8), job.status, "run_at", job.run_at);
await db.from("engine_jobs").update({ run_at: marker }).eq("id", job.id);
const t0 = Date.now();
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const j = (await db.from("engine_jobs").select("status, result, locked_by, finished_at").eq("id", job.id).single()).data;
  if (j.status !== "queued" && j.status !== "running") {
    const wi = (await db.from("work_items").select("status, decided_path, result").eq("workspace_id", ws).eq("action", "remind_shift").order("created_at", { ascending: false }).limit(1)).data[0];
    console.log(`job ${j.status} after ${Math.round((Date.now() - t0) / 1000)} s by ${j.locked_by ?? "app-shifts"}:`, JSON.stringify(j.result), "| work item", wi?.status, wi?.decided_path, wi?.result?.summary);
    process.exit(0);
  }
}
console.log("job still queued after 200 s: the production tick did not pick it up");
process.exit(1);
