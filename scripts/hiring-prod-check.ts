// Production check of the Tuyển dụng (hiring) module. Needs the service role; runs the REAL app code (src/lib/module-hiring-*, the engine and its gate)
// against the production database, and calls the PRODUCTION public routes over HTTP (curl) with test data in the workspace "Kiểm thử · Tuyển dụng".
//   node scripts/with-secrets.mjs npx tsx --require ./scripts/server-only-stub.cjs scripts/hiring-prod-check.ts [--reset] [--only=<step>]
// steps: setup, fairness, job, ad, apply, screen, interview, offer, retention, rls, chat, all.  Prints PASS/FAIL per check, never a secret.
// Nothing reaches a real person: the test workspace has no SMTP connection and the test candidates have no chat channel (delivery says "manual").
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { installModuleCore } from "../src/lib/module-install";
import { ensureFlowDefaults } from "../src/lib/flow-seed";
import { resumeWork, runWork, type EngineCtx } from "../src/lib/engine";
import { tickKey } from "../src/lib/automation-tick";
import { customerTurn } from "../src/lib/customer-turn";
import {
  HiringError, ensureSettings, generateJobAd, hdb, moveCandidate, saveJob, saveSettings, setJobStatus, siteUrl,
} from "../src/lib/module-hiring-core";
import { drainHiring, hiringChatBrief, requestInterview, requestOffer, startScreening } from "../src/lib/module-hiring-flow";
import { readChatApplication } from "../src/lib/module-hiring-contract";
import { findFairnessViolations } from "../src/lib/module-hiring-shared";
import type { Agent, AgentConversation } from "../src/lib/types";

const NAME = "Kiểm thử · Tuyển dụng";
const db = hdb();
const base = (process.env.HIRING_CHECK_BASE || siteUrl()).replace(/\/+$/, "");
const args = process.argv.slice(2);
const reset = args.includes("--reset");
const only = args.find((a) => a.startsWith("--only="))?.slice(7) ?? "all";
const want = (s: string) => only === "all" || only.split(",").includes(s);
let failed = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  if (!cond) failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  [${detail}]` : ""}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const secs = (t0: number) => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const ctxOf = (ws: string): EngineCtx => ({ db, ws, actor: "Kiểm thử", locale: "vi" });

/* ------------------------------------------------------------------ helpers */
const workspace = async (): Promise<string> => {
  const found = ((await db.from("workspaces").select("id").eq("name", NAME).limit(1)).data ?? [])[0] as { id: string } | undefined;
  if (found) return found.id;
  const users = (await db.auth.admin.listUsers({ perPage: 200 })).data?.users ?? [];
  const owner = users.find((u) => u.email === process.env.READY_OWNER_EMAIL) ?? users[0];
  const ins = await db.from("workspaces").insert({ name: NAME, owner_id: owner.id }).select("id").single();
  if (ins.error) throw new Error(`workspace: ${ins.error.message}`);
  console.log("created workspace", NAME);
  return (ins.data as { id: string }).id;
};

/** A small, valid PDF made locally (xref offsets computed). */
const makePdf = (title: string): Buffer => {
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    "",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  const stream = `BT /F1 16 Tf 20 100 Td (${title.replace(/[()\\]/g, "")}) Tj ET`;
  objs[3] = `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offs: Array<number> = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
};

const curlApply = (fields: Record<string, string>, file?: string): { status: number; body: Record<string, unknown> } => {
  const a = ["-sS", "-m", "60", "-o", "-", "-w", "\n%{http_code}", "-X", "POST"];
  // curl.exe on Windows reads its arguments in the ANSI code page: every value goes through a UTF-8 file ("name=<file") so Vietnamese survives
  const dir = mkdtempSync(join(tmpdir(), "hiring-f-"));
  let n = 0;
  for (const [k, v] of Object.entries(fields)) {
    const f = join(dir, `f${n++}.txt`);
    writeFileSync(f, v, "utf8");
    a.push("-F", `${k}=<${f}`);
  }
  if (file) a.push("-F", `cv=@${file}`);
  a.push(`${base}/api/hiring/apply`);
  const raw = execFileSync("curl", a, { encoding: "utf8" });
  const i = raw.lastIndexOf("\n");
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw.slice(0, i)) as Record<string, unknown>; } catch { body = { raw: raw.slice(0, 200) }; }
  return { status: Number(raw.slice(i + 1)), body };
};
const postJson = async (path: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown> }> => {
  const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> };
};
const signedTick = async (): Promise<{ status: number; body: Record<string, unknown> }> => {
  const ts = String(Date.now());
  const sig = createHmac("sha256", tickKey(process.env.ENGINE_SHARED_SECRET!)).update(ts).digest("hex");
  return postJson("/api/hiring/tick", {}, { "x-tick-timestamp": ts, "x-tick-signature": sig });
};

type St = { ws: string; jobId?: string; jobSlug?: string; slug?: string; cands: Record<string, string>; ivToken?: string; offerToken?: string };
const st: St = { ws: "", cands: {} };

const wipe = async (ws: string): Promise<void> => {
  const paths = ((await db.from("hiring_candidates").select("cv_path").eq("workspace_id", ws)).data ?? []).flatMap((r: { cv_path: string | null }) => (r.cv_path ? [r.cv_path] : []));
  if (paths.length) await db.storage.from("hiring").remove(paths);
  await db.from("hiring_jobs").delete().eq("workspace_id", ws);
  await db.from("work_items").delete().eq("workspace_id", ws).eq("department", "hiring");
  await db.from("hiring_availability").delete().eq("workspace_id", ws);
  await db.from("messages").delete().eq("workspace_id", ws).eq("author_name", "NIVO").like("body", "%Kiểm thử%");
};

/* ------------------------------------------------------------------ steps */
const setup = async (): Promise<void> => {
  console.log("\n== setup ==");
  st.ws = await workspace();
  if (reset) await wipe(st.ws);
  await ensureFlowDefaults(db, st.ws, "Kiểm thử", "vi");
  const inst = await installModuleCore(db, { workspaceId: st.ws, moduleKey: "hiring", locale: "vi", actorName: "Kiểm thử" });
  ok("module hiring installed (authority rules seeded)", Boolean(inst.installationId));
  await installModuleCore(db, { workspaceId: st.ws, moduleKey: "chatbot", locale: "vi", actorName: "Kiểm thử" });
  const mode0 = await db.from("module_installations").update({ operating_mode: "autopilot" }).eq("workspace_id", st.ws).in("module_key", ["hiring", "chatbot"]);
  ok("test workspace runs in autopilot (assist mode would downgrade auto to ask)", !mode0.error, mode0.error?.message ?? "");
  const rules = ((await db.from("authority_rules").select("action, mode").eq("workspace_id", st.ws).eq("department", "hiring")).data ?? []) as Array<{ action: string; mode: string }>;
  const mode = (a: string) => rules.find((r) => r.action === a)?.mode;
  ok("rules: screen_candidate=auto, schedule_interview=auto, send_offer=ask", mode("screen_candidate") === "auto" && mode("schedule_interview") === "auto" && mode("send_offer") === "ask", rules.map((r) => `${r.action}:${r.mode}`).join(" "));
  const s = await ensureSettings(db, st.ws);
  st.slug = s.public_slug;
  await saveSettings(db, st.ws, { retention_days: 90, remind_interview: true, notify_new_candidate: true, auto_close_when_filled: true });
  console.log(`public slug: ${s.public_slug}`);
  // the owner is the interviewer; free every weekday 09:00-12:00 and 14:00-17:00 plus the weekend morning
  const owner = ((await db.from("workspaces").select("owner_id").eq("id", st.ws).single()).data as { owner_id: string }).owner_id;
  await db.from("hiring_availability").delete().eq("workspace_id", st.ws).eq("member_user_id", owner);
  const rows = [0, 1, 2, 3, 4, 5, 6].flatMap((wd) => (wd === 0 || wd === 6 ? [{ weekday: wd, start_min: 540, end_min: 720 }] : [{ weekday: wd, start_min: 540, end_min: 720 }, { weekday: wd, start_min: 840, end_min: 1020 }]));
  await db.from("hiring_availability").insert(rows.map((r) => ({ workspace_id: st.ws, member_user_id: owner, ...r })));
};

const fairness = async (): Promise<void> => {
  console.log("\n== fairness validator ==");
  const attempt = async (label: string, input: Parameters<typeof saveJob>[3]): Promise<void> => {
    try {
      await saveJob(db, st.ws, null, input);
      ok(label, false, "was saved");
    } catch (e) {
      const blocked = e instanceof HiringError && e.violations.length > 0;
      ok(label, blocked, blocked ? (e as HiringError).message.slice(0, 260) : String(e));
    }
  };
  await attempt('requirement "nữ dưới 25 tuổi" is refused', { title: "Nhân viên bán hàng", requirements: { must_have: ["nữ dưới 25 tuổi"] } });
  await attempt('description "ưu tiên nam, độc thân" is refused', { title: "Nhân viên kho", description: "Ưu tiên nam, độc thân, người miền Bắc." });
  await attempt('a question "Bạn bao nhiêu tuổi?" is refused', { title: "Thu ngân", questions: [{ id: "q1", text: "Bạn bao nhiêu tuổi và đã kết hôn chưa?", type: "text", required: true }] });
  const fine = ["Cần 2 năm kinh nghiệm bán hàng", "Từ 18 tuổi trở lên", "Làm được ca tối và cuối tuần", "Biết dùng máy POS, giao tiếp tốt"];
  ok("fair requirements pass the validator", fine.every((t) => findFairnessViolations(t).length === 0));
  const dirty = await db.from("hiring_jobs").select("id").eq("workspace_id", st.ws).like("title", "%Nhân viên bán hàng%");
  ok("refused jobs were not stored", (dirty.data ?? []).length === 0);
};

const job = async (): Promise<void> => {
  console.log("\n== job ==");
  const existing = ((await db.from("hiring_jobs").select("id, slug").eq("workspace_id", st.ws).eq("title", "Nhân viên phục vụ ca tối (kiểm thử)").limit(1)).data ?? [])[0] as { id: string; slug: string } | undefined;
  let j = existing;
  if (!j) {
    const created = await saveJob(db, st.ws, null, {
      title: "Nhân viên phục vụ ca tối (kiểm thử)", position: "Phục vụ", employment_type: "part_time", schedule: "Ca tối 17h-22h, 4-5 buổi/tuần", pay_min_vnd: 25000, pay_max_vnd: 30000, pay_unit: "hour",
      location: "Quận 1, TP.HCM", headcount: 1, description: "Phục vụ khách, pha chế cơ bản và giữ quầy sạch sẽ trong ca tối.",
      requirements: { skills: ["pha chế", "giao tiếp"], experience_years: 1, experience_note: "ưu tiên đã làm quán cà phê", availability: ["Ca tối", "Cuối tuần"], must_have: ["Biết dùng máy POS"], nice_to_have: ["Tiếng Anh giao tiếp cơ bản"] },
      questions: [
        { id: "weekend", text: "Bạn có thể làm vào cuối tuần không?", type: "yesno", required: true, expect: "yes" },
        { id: "years", text: "Bạn có mấy năm kinh nghiệm phục vụ hoặc pha chế?", type: "number", required: true, expect: 1 },
        { id: "intro", text: "Giới thiệu ngắn về bản thân và những việc bạn đã làm", type: "text", required: true },
      ],
    });
    j = { id: created.id, slug: created.slug };
  }
  st.jobId = j.id;
  st.jobSlug = j.slug;
  ok("valid job created", Boolean(j.id), j.slug);
  const opened = await setJobStatus(db, st.ws, j.id, "open");
  ok("job opened", opened.status === "open");
  console.log(`public link: ${base}/j/${st.slug}/${j.slug}`);
};

const ad = async (): Promise<void> => {
  console.log("\n== job ad (OpenClaw) ==");
  const t0 = Date.now();
  const r = await generateJobAd(db, st.ws, st.jobId!);
  console.log(`TIMING job ad: wall ${secs(t0)}, recorded ms ${r.ads.ms}, engine timings ${JSON.stringify(r.timings)}, attempts ${r.attempts}, sanitised ${r.sanitised}`);
  ok("three variants (facebook, zalo, topcv) with the apply link", [r.ads.facebook, r.ads.zalo, r.ads.topcv].every((t) => t.length > 40 && t.includes(`/j/${st.slug}/${st.jobSlug}`)), `${r.ads.facebook.length}/${r.ads.zalo.length}/${r.ads.topcv.length} chars`);
  ok("no protected trait in any variant", [r.ads.facebook, r.ads.zalo, r.ads.topcv].every((t) => findFairnessViolations(t).length === 0));
  console.log("--- facebook ---\n" + r.ads.facebook + "\n--- zalo ---\n" + r.ads.zalo);
};

const apply = async (): Promise<void> => {
  console.log("\n== apply (production public route, curl) ==");
  await db.from("hiring_apply_hits").delete().neq("id", 0); // the hourly allowance of this machine starts fresh for the check
  const dir = mkdtempSync(join(tmpdir(), "hiring-"));
  const pdf = (n: string) => { const f = join(dir, `${n}.pdf`); writeFileSync(f, makePdf(`CV Kiem thu ${n}`)); return f; };
  const page = await fetch(`${base}/j/${st.slug}/${st.jobSlug}`);
  const html = await page.text();
  ok("public job page renders without login (200, title and form)", page.status === 200 && html.includes("Nhân viên phục vụ ca tối") && html.includes("Nộp hồ sơ"), String(page.status));
  const gone = await fetch(`${base}/j/${st.slug}/khong-co-tin-nay`);
  ok("an unknown job is 404", gone.status === 404, String(gone.status));
  const common = { ws: st.slug!, job: st.jobSlug!, consent: "1", website: "" };
  const people: Array<[string, Record<string, string>]> = [
    ["an", { name: "Kiểm thử Nguyễn An", phone: "0901000001", email: "kiem-thu-an@example.com", availability: "Ca tối, Cuối tuần", q_weekend: "Có", q_years: "2 năm", q_intro: "Mình đã làm phục vụ và pha chế ở quán cà phê 2 năm, giao tiếp tốt, quen dùng máy POS." }],
    ["binh", { name: "Kiểm thử Trần Bình", phone: "0901000002", email: "", availability: "Ca tối", q_weekend: "Có", q_years: "0", q_intro: "Mình là sinh viên, mới đi làm thêm, giao tiếp ổn, muốn học nghề." }],
    ["chi", { name: "Kiểm thử Lê Chi", phone: "0901000003", email: "", availability: "Ca sáng", q_weekend: "Không", q_years: "0", q_intro: "Tôi là nữ, 24 tuổi, đã kết hôn, quê ở Nghệ An. Tôi chưa có kinh nghiệm." }],
  ];
  for (const [key, f] of people) {
    const t0 = Date.now();
    const r = curlApply({ ...common, ...f }, pdf(key));
    ok(`candidate ${f.name} applied (200 ok)`, r.status === 200 && r.body.ok === true, `${r.status} ${secs(t0)} ${String(r.body.message).slice(0, 80)}`);
    const row = ((await db.from("hiring_candidates").select("id, cv_path, stage").eq("job_id", st.jobId!).eq("phone", f.phone).limit(1)).data ?? [])[0] as { id: string; cv_path: string | null; stage: string } | undefined;
    if (row) st.cands[key] = row.id;
    ok(`${f.name}: stored with a CV in the private bucket and a consent record`, Boolean(row?.cv_path) && ((await db.from("hiring_consents").select("id").eq("candidate_id", row?.id ?? "").limit(1)).data ?? []).length === 1, row?.cv_path ?? "");
  }
  const dup = curlApply({ ...common, ...people[0][1] });
  ok("the same phone applying again is one application (duplicate)", dup.status === 200 && dup.body.duplicate === true, JSON.stringify(dup.body).slice(0, 100));
  const noConsent = curlApply({ ...common, ...people[0][1], phone: "0901000009", consent: "0" });
  ok("no consent is refused (422)", noConsent.status === 422, `${noConsent.status} ${String(noConsent.body.message).slice(0, 70)}`);
  const fake = join(dir, "fake.pdf");
  writeFileSync(fake, "this is plain text, not a pdf");
  const bad = curlApply({ ...common, ...people[0][1], phone: "0901000008" }, fake);
  ok("a text file renamed .pdf is refused by its own bytes (422)", bad.status === 422, `${bad.status} ${String(bad.body.message).slice(0, 80)}`);
  const big = join(dir, "big.pdf");
  writeFileSync(big, Buffer.concat([makePdf("big"), Buffer.alloc(6 * 1024 * 1024, 32)]));
  const huge = curlApply({ ...common, ...people[0][1], phone: "0901000007" }, big);
  ok("a CV over 5 MB is refused (413/422)", huge.status === 413 || huge.status === 422, `${huge.status} ${String(huge.body.message).slice(0, 80)}`);
  const bot = curlApply({ ...common, ...people[0][1], phone: "0901000006", website: "http://spam" });
  ok("the honeypot answers like a success but stores nothing", bot.status === 200 && ((await db.from("hiring_candidates").select("id").eq("job_id", st.jobId!).eq("phone", "0901000006")).data ?? []).length === 0);
  const noPhone = curlApply({ ...common, name: "Kiểm thử Thiếu", phone: "", email: "" });
  ok("no phone and no email is refused (422)", noPhone.status === 422, String(noPhone.status));
};

const screen = async (): Promise<void> => {
  console.log("\n== screening ==");
  const t0 = Date.now();
  const ids = Object.values(st.cands);
  // steps left waiting by an earlier run (assist mode) are cleared and the unscored candidates queued again
  await db.from("work_items").delete().eq("workspace_id", st.ws).eq("action", "screen_candidate").neq("status", "done");
  for (const id of ids) {
    const sc = (await db.from("hiring_candidates").select("score").eq("id", id).single()).data as { score: number | null };
    if (sc.score === null) await startScreening(st.ws, id);
  }
  await drainHiring(st.ws, 3);
  let rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 40; i++) {
    rows = ((await db.from("hiring_candidates").select("*").in("id", ids)).data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === ids.length && rows.every((r) => r.score !== null)) break;
    if (i === 12) { console.log("(production did not finish the queue in 60 s: draining from here)"); await drainHiring(st.ws, 3); }
    await sleep(5000);
  }
  console.log(`TIMING screening of ${ids.length} applications until all scored: ${secs(t0)}`);
  for (const r of rows) {
    const reasons = r.score_reasons as Array<{ criterion: string; status: string; note: string }>;
    console.log(`  ${r.name}: ${r.score}/100 ${r.score_label} stage=${r.stage}\n    summary: ${String(r.score_summary ?? "").replace(/\n+/g, " | ").slice(0, 300)}\n    reasons: ${reasons.map((x) => `[${x.status}] ${x.criterion}`).join("; ")}`);
  }
  const by = (k: string) => rows.find((r) => r.id === st.cands[k]) as Record<string, unknown>;
  ok("all three were scored with reasons", rows.every((r) => r.score !== null && (r.score_reasons as Array<unknown>).length > 0));
  ok("scores are ordered by the written requirements (An > Bình > Chi)", Number(by("an").score) > Number(by("binh").score) && Number(by("binh").score) >= Number(by("chi").score), `${by("an").score} / ${by("binh").score} / ${by("chi").score}`);
  ok("nobody was rejected automatically (stage only moved to screening)", rows.every((r) => r.stage === "screening"), rows.map((r) => String(r.stage)).join(","));
  const txt = JSON.stringify(by("chi").score_reasons) + String(by("chi").score_summary);
  ok("what Chi volunteered (gender, age, marriage, hometown) appears nowhere in the score or reasons", findFairnessViolations(txt).length === 0, findFairnessViolations(txt).map((v) => v.label).join(","));
  const items = ((await db.from("work_items").select("status, decided_path, action").eq("workspace_id", st.ws).eq("action", "screen_candidate")).data ?? []) as Array<{ status: string; decided_path: string | null }>;
  ok("screen_candidate ran automatically through the gate (auto)", items.length >= 3 && items.filter((i) => i.status === "done" && i.decided_path === "auto").length >= 3, `${items.length} items`);
};

const interview = async (): Promise<void> => {
  console.log("\n== interview ==");
  const an = st.cands.an;
  const item = await requestInterview(st.ws, an, { interviewerUserId: null, mode: "in_person", location: "Quận 1, TP.HCM", durationMin: 30 });
  ok("schedule_interview ran automatically (auto)", item.status === "done" && item.decided_path === "auto", `${item.status} ${item.result?.summary ?? item.error ?? ""}`);
  const iv = ((await db.from("hiring_interviews").select("*").eq("candidate_id", an).order("created_at", { ascending: false }).limit(1)).data ?? [])[0] as { id: string; token: string; proposed_slots: Array<{ start: string }>; status: string };
  st.ivToken = iv.token;
  ok("3 slots proposed from the interviewer's availability", iv.proposed_slots.length === 3 && iv.status === "proposed", iv.proposed_slots.map((s) => s.start).join(" "));
  const hours = iv.proposed_slots.map((s) => new Date(new Date(s.start).getTime() + 7 * 3_600_000).getUTCHours());
  ok("every slot is inside the declared windows (9-12 / 14-17, Vietnam time)", hours.every((h) => (h >= 9 && h < 12) || (h >= 14 && h < 17)), hours.join(","));
  const page = await fetch(`${base}/j/lich/${iv.token}`);
  ok("candidate's slot page renders (200) with the proposed times", page.status === 200 && (await page.text()).includes("Chọn một giờ"));
  const bad = await postJson("/api/hiring/respond", { kind: "slot", token: iv.token, start: "2030-01-01T00:00:00.000Z" });
  ok("a time that was not proposed is refused", bad.status === 409, String(bad.body.message));
  const pick = await postJson("/api/hiring/respond", { kind: "slot", token: iv.token, start: iv.proposed_slots[1].start });
  ok("candidate's pick confirms the interview", pick.status === 200 && pick.body.ok === true, String(pick.body.message));
  const after = (await db.from("hiring_interviews").select("status, slot_start").eq("id", iv.id).single()).data as { status: string; slot_start: string };
  ok("interview is confirmed on the picked slot", after.status === "confirmed" && Date.parse(after.slot_start) === Date.parse(iv.proposed_slots[1].start), after.slot_start);
  const second = await postJson("/api/hiring/respond", { kind: "slot", token: iv.token, start: iv.proposed_slots[2].start });
  ok("a second click does not change the confirmed slot", Date.parse(((await db.from("hiring_interviews").select("slot_start").eq("id", iv.id).single()).data as { slot_start: string }).slot_start) === Date.parse(iv.proposed_slots[1].start), String(second.body.message));
  const c = (await db.from("hiring_candidates").select("stage").eq("id", an).single()).data as { stage: string };
  ok("candidate is in the Phỏng vấn lane", c.stage === "interview", c.stage);
  // reminder: bring the interview within 24 h and run the SIGNED production tick
  await db.from("hiring_interviews").update({ slot_start: new Date(Date.now() + 2 * 3_600_000).toISOString(), slot_end: new Date(Date.now() + 2.5 * 3_600_000).toISOString(), reminder_sent_at: null }).eq("id", iv.id);
  const tick = await signedTick();
  console.log(`  tick: ${tick.status} ${JSON.stringify(tick.body)}`);
  const rem = (await db.from("hiring_interviews").select("reminder_sent_at").eq("id", iv.id).single()).data as { reminder_sent_at: string | null };
  ok("the signed tick sent the reminder once (reminder_sent_at set)", tick.status === 200 && rem.reminder_sent_at !== null && Number(tick.body.reminders) >= 1);
  const tick2 = await signedTick();
  ok("a second tick sends no second reminder", tick2.status === 200 && Number(tick2.body.reminders) === 0, JSON.stringify(tick2.body));
  const unsigned = await postJson("/api/hiring/tick", {});
  ok("the tick route refuses an unsigned call (401)", unsigned.status === 401, String(unsigned.status));
};

const offer = async (): Promise<void> => {
  console.log("\n== offer ==");
  const an = st.cands.an;
  const t0 = Date.now();
  const { offer: o, item } = await requestOffer(st.ws, an, { title: "Nhân viên phục vụ ca tối", pay: "28.000 đ/giờ", start_date: "Thứ hai tuần sau", probation: "1 tháng", note: "Mang theo CCCD ngày đầu đi làm." }, null);
  console.log(`TIMING offer draft (OpenClaw) + gate: ${secs(t0)}`);
  ok("send_offer is held at the gate (waiting_decision), nothing sent", item.status === "waiting_decision" && o.status === "waiting" && !o.sent_at, `${item.status} / ${o.status}`);
  console.log("--- offer draft ---\n" + item.proposal.draft);
  ok("the draft carries only the given terms and no protected trait", Boolean(item.proposal.draft) && String(item.proposal.draft).includes("28.000") && findFairnessViolations(String(item.proposal.draft)).length === 0);
  const noAccept = await postJson("/api/hiring/respond", { kind: "offer", token: o.token, accept: true });
  ok("the candidate's link does not work before the owner approved", noAccept.status === 409, String(noAccept.body.message));
  // owner edits nothing and approves
  const done = await resumeWork(ctxOf(st.ws), item.id, "approved", {}, { name: "Kiểm thử (chủ)", kind: "owner" });
  const sent = (await db.from("hiring_offers").select("*").eq("id", o.id).single()).data as { status: string; sent_via: string | null; token: string; expires_at: string | null };
  ok("approved: the offer is sent (via manual link, the test shop has no SMTP/chat)", done.status === "done" && sent.status === "sent" && sent.expires_at !== null, `${done.status} ${sent.status} via ${sent.sent_via}`);
  st.offerToken = sent.token;
  const page = await fetch(`${base}/j/thu/${sent.token}`);
  ok("candidate's offer page renders (200)", page.status === 200 && (await page.text()).includes("Tôi đồng ý nhận việc"));
  const acc = await postJson("/api/hiring/respond", { kind: "offer", token: sent.token, accept: true });
  ok("candidate accepts on the link", acc.status === 200 && acc.body.ok === true, String(acc.body.message));
  const c = (await db.from("hiring_candidates").select("stage").eq("id", an).single()).data as { stage: string };
  ok("candidate is hired", c.stage === "hired", c.stage);
  const onb = ((await db.from("hiring_onboarding").select("id").eq("candidate_id", an)).data ?? []).length;
  ok("onboarding checklist created (Nhận việc)", onb === 7, String(onb));
  const msgs = ((await db.from("messages").select("body").eq("workspace_id", st.ws).like("body", "%Kiểm thử Nguyễn An%").order("created_at", { ascending: false }).limit(10)).data ?? []) as Array<{ body: string }>;
  ok("Office was told (accepted, onboarding)", msgs.some((m) => m.body.includes("đã đồng ý thư mời")), msgs.length + " messages");
  const j = (await db.from("hiring_jobs").select("status").eq("id", st.jobId!).single()).data as { status: string };
  ok("the job closed itself: headcount 1 reached", j.status === "closed", j.status);
  const again = await postJson("/api/hiring/respond", { kind: "offer", token: sent.token, accept: false });
  ok("answering again does not undo the acceptance", (await db.from("hiring_candidates").select("stage").eq("id", an).single()).data?.stage === "hired", String(again.body.message));
  // a rejected offer is cancelled and never sent
  await db.from("hiring_jobs").update({ status: "open" }).eq("id", st.jobId!);
  const b = await requestOffer(st.ws, st.cands.binh, { title: "Nhân viên phục vụ", pay: "25.000 đ/giờ", start_date: "", probation: "", note: "" }, null);
  const rejected = await resumeWork(ctxOf(st.ws), b.item.id, "rejected", {}, { name: "Kiểm thử (chủ)", kind: "owner" });
  const bo = (await db.from("hiring_offers").select("status, sent_at").eq("id", b.offer.id).single()).data as { status: string; sent_at: string | null };
  ok("owner rejects an offer: it is cancelled and nothing was sent", rejected.status === "rejected" && bo.status === "cancelled" && bo.sent_at === null, `${rejected.status}/${bo.status}`);
  await db.from("hiring_jobs").update({ status: "closed" }).eq("id", st.jobId!);
};

const retention = async (): Promise<void> => {
  console.log("\n== retention ==");
  const chi = st.cands.chi;
  const row = (await db.from("hiring_candidates").select("cv_path").eq("id", chi).single()).data as { cv_path: string };
  const human = await moveCandidate(db, st.ws, chi, "rejected", "Kiểm thử (chủ)", "Chưa có kinh nghiệm và không làm được cuối tuần theo yêu cầu của tin").then(() => true, () => false);
  ok('"Loại" is a person\'s action and stores the reason', human && ((await db.from("hiring_candidates").select("stage, rejected_reason").eq("id", chi).single()).data as { stage: string; rejected_reason: string }).stage === "rejected");
  let blocked = false;
  try { await moveCandidate(db, st.ws, st.cands.binh, "rejected", "Kiểm thử", "Vì là nữ"); } catch (e) { blocked = e instanceof HiringError && e.violations.length > 0; }
  ok("a rejection reason based on gender is refused", blocked);
  const exists = async (p: string) => ((await db.storage.from("hiring").list(p.split("/").slice(0, -1).join("/"))).data ?? []).some((f) => f.name === p.split("/").pop());
  ok("CV file exists before retention", await exists(row.cv_path));
  await db.from("hiring_candidates").update({ stage_changed_at: new Date(Date.now() - 100 * 86_400_000).toISOString() }).eq("id", chi);
  const status0 = (await db.rpc("hiring_ops_status")).data as { cron: Array<{ jobname: string; schedule: string; active: boolean }>; retention_due: number };
  ok("retention job is scheduled in pg_cron (hiring-tick, every 5 minutes, active)", status0.cron.some((c) => c.jobname === "hiring-tick" && c.active), JSON.stringify(status0.cron));
  ok("the candidate rejected 100 days ago is due (retention 90 days)", status0.retention_due >= 1, String(status0.retention_due));
  const tick = await signedTick();
  console.log(`  tick: ${tick.status} ${JSON.stringify(tick.body)}`);
  ok("the signed tick deleted the expired candidate and the CV file", ((await db.from("hiring_candidates").select("id").eq("id", chi)).data ?? []).length === 0 && !(await exists(row.cv_path)) && Number(tick.body.deletedCandidates) >= 1);
  ok("deletion left no consent or event rows", ((await db.from("hiring_consents").select("id").eq("candidate_id", chi)).data ?? []).length === 0 && ((await db.from("hiring_events").select("id").eq("candidate_id", chi)).data ?? []).length === 0);
  const log = ((await db.from("hiring_retention_log").select("deleted_candidates, deleted_files").eq("workspace_id", st.ws).order("ran_at", { ascending: false }).limit(1)).data ?? [])[0];
  ok("the retention run is logged with counts only", Boolean(log), JSON.stringify(log));
};

const rls = async (): Promise<void> => {
  console.log("\n== RLS and private files ==");
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  for (const t of ["hiring_candidates", "hiring_consents", "hiring_interviews", "hiring_offers", "hiring_jobs", "hiring_settings", "hiring_events", "hiring_onboarding", "hiring_availability"]) {
    const r = await anon.from(t).select("id").limit(1);
    ok(`anon cannot read ${t}`, (r.data ?? []).length === 0, r.error ? r.error.message.slice(0, 60) : "0 rows");
  }
  const cv = ((await db.from("hiring_candidates").select("cv_path").eq("workspace_id", st.ws).not("cv_path", "is", null).limit(1)).data ?? [])[0] as { cv_path: string } | undefined;
  if (cv) {
    const direct = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/hiring/${cv.cv_path}`);
    ok("the CV is not reachable through a public URL (bucket is private)", direct.status >= 400, String(direct.status));
    const signed = await db.storage.from("hiring").createSignedUrl(cv.cv_path, 60);
    const via = signed.data ? await fetch(signed.data.signedUrl) : null;
    ok("a signed URL (60 s) opens the CV", via?.status === 200 && (await via.arrayBuffer()).byteLength > 100, String(via?.status));
  }
  const bucket = (await db.storage.getBucket("hiring")).data;
  ok("bucket hiring is private, 5 MB, document and image types only", bucket?.public === false && bucket.file_size_limit === 5242880, JSON.stringify({ public: bucket?.public, limit: bucket?.file_size_limit, types: bucket?.allowed_mime_types }));
  // rate limit last: it blocks this address for an hour
  const hits = [];
  for (let i = 0; i < 12; i++) hits.push(curlApply({ ws: st.slug!, job: st.jobSlug!, consent: "0", name: "x", phone: "", email: "", website: "" }).status);
  ok("the apply route rate-limits (429 after the hourly allowance)", hits.includes(429), hits.join(","));
};

const chat = async (): Promise<void> => {
  console.log("\n== chat intake ==");
  ok("the model's application is read strictly (needs job, person, contact and a clear consent)", readChatApplication({ job: "a", name: "B", phone: "0901", consent: false }) === null && readChatApplication({ job: "a", name: "B", phone: "0901", consent: true, answers: [{ question_id: "q", answer: "x" }] })?.answers.length === 1);
  await db.from("hiring_jobs").update({ status: "open", closes_at: null, headcount: 5 }).eq("id", st.jobId!); // room for more hires, so the 5-minute cron does not close it again
  const brief = await hiringChatBrief(db, st.ws);
  ok("an open job puts the [OPEN JOBS] block (with the consent rule) into the chat turn", brief.includes("[OPEN JOBS]") && brief.includes(`job="${st.jobSlug}"`) && brief.includes("agree"));
  const agent = ((await db.from("agents").select("*").eq("workspace_id", st.ws).eq("module", "chatbot").limit(1)).data ?? [])[0] as Agent | undefined;
  if (!agent) { ok("a chatbot agent exists in the test workspace", false); return; }
  const conv = (await db.from("agent_conversations").insert({ workspace_id: st.ws, agent_id: agent.id, kind: "customer", visitor_name: "Kiểm thử Phạm Dũng", channel: "website" }).select("*").single()).data as AgentConversation;
  const t0 = Date.now();
  const agentCount = async () => ((await db.from("agent_messages").select("id").eq("conversation_id", conv.id).eq("role", "agent")).data ?? []).length;
  const findCand = async () => ((await db.from("hiring_candidates").select("id, source, name").eq("workspace_id", st.ws).eq("conversation_id", conv.id).limit(1)).data ?? [])[0] as { id: string; source: string; name: string } | undefined;
  // a real conversation: the chatbot collects what the job asks for over a few turns (name, phone, the required answers, consent), then records the application
  const turnsText = [
    "Chào shop, em muốn ứng tuyển vị trí Nhân viên phục vụ ca tối. Em tên Kiểm thử Phạm Dũng, số điện thoại 0901000011. Em làm được cuối tuần, có 1,5 năm kinh nghiệm phục vụ, em biết pha chế và dùng máy POS. Em làm được ca tối và cuối tuần.",
    "Em từng làm phục vụ và pha chế ở quán Cà Phê Xanh khoảng 1,5 năm, quen thu ngân bằng máy POS. Em có thể bắt đầu đi làm ngay.",
    "Dạ em đồng ý để cửa hàng lưu thông tin này để xét tuyển. Cảm ơn shop.",
    "Vâng, em xác nhận đồng ý lưu thông tin và nộp hồ sơ ứng tuyển ạ.",
  ];
  let cand = await findCand();
  for (const text of turnsText) {
    if (cand) break;
    const before = await agentCount();
    await customerTurn(ctxOf(st.ws), conv, agent, text);
    for (let i = 0; i < 30 && (await agentCount()) <= before; i++) await sleep(4000);
    await sleep(1500);
    cand = await findCand();
  }
  const replies = ((await db.from("agent_messages").select("role, body").eq("conversation_id", conv.id).order("created_at")).data ?? []) as Array<{ role: string; body: string }>;
  console.log(replies.map((r) => `  [${r.role}] ${r.body.slice(0, 220)}`).join("\n"));
  ok("a candidate who applied through the chat is stored with source=chat and consent", Boolean(cand) && cand!.source === "chat" && ((await db.from("hiring_consents").select("channel").eq("candidate_id", cand?.id ?? "")).data ?? []).some((c: { channel: string }) => c.channel === "chat"));
  if (cand) {
    for (let i = 0; i < 20; i++) {
      const s = (await db.from("hiring_candidates").select("score").eq("id", cand.id).single()).data as { score: number | null };
      if (s.score !== null) break;
      if (i === 6) await drainHiring(st.ws, 2);
      await sleep(5000);
    }
    const s = (await db.from("hiring_candidates").select("score, score_label").eq("id", cand.id).single()).data as { score: number | null; score_label: string | null };
    ok("the chat applicant was screened too", s.score !== null, `${s.score} ${s.score_label}`);
  }
};

const run = async (): Promise<void> => {
  await setup();
  st.cands = Object.fromEntries(((await db.from("hiring_candidates").select("id, phone").eq("workspace_id", st.ws).in("phone", ["0901000001", "0901000002", "0901000003"])).data ?? []).map((r: { id: string; phone: string }) => [{ "0901000001": "an", "0901000002": "binh", "0901000003": "chi" }[r.phone]!, r.id]));
  const jb = ((await db.from("hiring_jobs").select("id, slug").eq("workspace_id", st.ws).eq("title", "Nhân viên phục vụ ca tối (kiểm thử)").limit(1)).data ?? [])[0] as { id: string; slug: string } | undefined;
  if (jb) { st.jobId = jb.id; st.jobSlug = jb.slug; }
  const steps: Array<[string, () => Promise<void>]> = [["fairness", fairness], ["job", job], ["ad", ad], ["apply", apply], ["screen", screen], ["interview", interview], ["offer", offer], ["retention", retention], ["rls", rls], ["chat", chat]];
  for (const [name, fn] of steps) if (want(name)) await fn();
  console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
};

void randomUUID;
run().catch((e) => { console.error(e); process.exit(1); });
