import "server-only";
import { randomUUID } from "node:crypto";
import type { EngineCtx, Performed, Prepared } from "./engine";
import { runQueued, runWork } from "./engine";
import { renderEmail } from "./email/layout";
import { sendWorkspaceEmail } from "./email/send";
import { generateWithOpenClaw } from "./openclaw-generate";
import {
  HiringError, ensureSettings, hdb, loadCandidate, loadJob, logCandidate, parseLooseJson, postOffice, publicJobUrl, siteUrl, submitApplication, type Db,
} from "./module-hiring-core";
import {
  EMPLOYMENT_LABEL, SCORE_LABEL, STAGE_LABEL, criteriaText, findFairnessViolations, fmtPay, fmtVnDateTime, scrubProtected, screenAgainstRequirements, vnInstant, vnParts,
  type CandidateRow, type InterviewRow, type JobRow, type OfferRow, type OfferTerms, type ScoreLabel, type ScoreReason, type Slot,
} from "./module-hiring-shared";
import { HIRING_APPLICATION_CLAUSE, HIRING_APPLICATION_SHAPE, type ChatApplication } from "./module-hiring-contract";
import { deliverToChannel } from "./telegram";
import type { WorkItem } from "./flow-types";

/**
 * Hiring flow (server): screening, interview scheduling, offers, the messages to candidates, and the candidate's own links.
 * The three authority actions run through the engine gate (runWork): screen_candidate (auto), schedule_interview (auto), send_offer (ask).
 * Texts to candidates are always sent from inside a performer, i.e. after the gate let the item through.
 */
export const hiringCtx = (ws: string, db: Db = hdb()): EngineCtx => ({ db, ws, actor: "NIVO", locale: "vi" });
const href = (candidateId: string) => `/m/hiring/workbench?tab=candidates&c=${candidateId}`;

const company = async (db: Db, ws: string): Promise<string> => ((await db.from("workspaces").select("name").eq("id", ws).maybeSingle()).data as { name: string } | null)?.name ?? "";
const contactOf = (c: Pick<CandidateRow, "email" | "phone">): string => c.email || c.phone;

/* ------------------------------------------------------------------ talking to the candidate */

export type Delivery = { readonly via: "chat" | "email" | "manual"; readonly delivered: boolean; readonly note: string };

/**
 * Send one message to a candidate: into their chat conversation (real on Telegram and Zalo) and by email when they gave one and the shop has SMTP.
 * `workItemId` is the item the authority gate let through; customer-facing email is refused without it. Never throws: the result says what happened.
 */
export const notifyCandidate = async (db: Db, ws: string, c: CandidateRow, m: { subject: string; text: string; workItemId: string }): Promise<Delivery> => {
  let chat: boolean | null = null;
  if (c.conversation_id) {
    try {
      await db.from("agent_messages").insert({ workspace_id: ws, conversation_id: c.conversation_id, role: "agent", body: m.text });
      const conv = (await db.from("agent_conversations").select("channel").eq("id", c.conversation_id).maybeSingle()).data as { channel: string | null } | null;
      chat = conv?.channel === "telegram" || conv?.channel === "zalo" ? await deliverToChannel(db, c.conversation_id, m.text) : true;
    } catch (e) {
      console.error("hiring chat delivery failed", e instanceof Error ? e.message : e);
      chat = false;
    }
  }
  let mail: "sent" | "failed" | "none" = "none";
  let mailNote = "";
  if (c.email) {
    const shop = await company(db, ws);
    const r = await sendWorkspaceEmail({
      workspaceId: ws, to: c.email, subject: m.subject, purpose: "hiring", audience: "customer", workItemId: m.workItemId, refs: { candidate_id: c.id },
      ...renderEmail({ shopName: shop, title: m.subject, body: m.text }),
    }).catch((e: unknown) => ({ status: "failed" as const, error: e instanceof Error ? e.message : String(e) }));
    mail = r.status === "sent" ? "sent" : "failed";
    if (r.status !== "sent") mailNote = ("error" in r && r.error) || "chưa gửi được email";
  }
  if (chat) return { via: "chat", delivered: true, note: mail === "sent" ? "Đã gửi qua chat và email." : "Đã gửi qua chat." };
  if (mail === "sent") return { via: "email", delivered: true, note: "Đã gửi qua email." };
  const why = [chat === false ? "chat chưa gửi được" : "", mailNote].filter(Boolean).join("; ");
  return { via: "manual", delivered: false, note: `Chưa gửi được tự động${why ? ` (${why})` : ""}: hãy gửi giúp ứng viên đường dẫn.` };
};

/* ------------------------------------------------------------------ screen_candidate */

const SCREEN_SYSTEM = `Bạn hỗ trợ chủ một doanh nghiệp nhỏ xét hồ sơ ứng viên. Chỉ dựa trên TIÊU CHÍ CÔNG VIỆC đã viết và CÂU TRẢ LỜI của ứng viên.
Không đánh giá và không nhắc tới giới tính, tuổi, tôn giáo, dân tộc, tình trạng hôn nhân, thai sản, khuyết tật, quê quán, ngoại hình, tên hay cách nói. Không kết luận nhận hay loại: chỉ tóm tắt cho người quyết định.
Trả về DUY NHẤT một JSON: {"summary": string, "interview_questions": [string, string, string]}.
- summary: tối đa 70 từ, tiếng Việt đơn giản: điểm đã khớp tiêu chí, điểm chưa rõ cần hỏi thêm.
- interview_questions: 3 câu hỏi phỏng vấn bám sát tiêu chí còn chưa rõ.`;

/** Queue (and, with `now`, start) the screening of one candidate. The item waits in the engine queue; runQueued performs it. */
export const startScreening = async (ws: string, candidateId: string, opts: { again?: boolean } = {}): Promise<WorkItem> =>
  runWork(hiringCtx(ws), {
    action: "screen_candidate", subject_type: "inbound", subject_id: candidateId, origin: "live", queue: true,
    dedupeKey: opts.again ? `screen_candidate:${candidateId}:${randomUUID().slice(0, 8)}` : `screen_candidate:${candidateId}`,
    seed: { summary: "Sàng lọc hồ sơ ứng viên", fields: { candidate_id: candidateId } },
  });

/** prepare of screen_candidate: the deterministic checklist plus (at most) one OpenClaw call for a summary and interview questions. */
export const prepareScreening = async (c: EngineCtx, item: WorkItem): Promise<Prepared> => {
  const candidateId = String(item.proposal.fields?.candidate_id ?? item.subject_id ?? "");
  const cand = await loadCandidate(c.db, c.ws, candidateId);
  const job = await loadJob(c.db, c.ws, cand.job_id);
  const s = screenAgainstRequirements(job, cand);
  let summary: string | null = null;
  let questions: Array<string> = [];
  const lines = s.reasons.map((r) => `- [${r.status === "met" ? "khớp" : r.status === "unmet" ? "chưa khớp" : "chưa rõ"}] ${r.criterion}: ${r.note}`).join("\n");
  const answers = cand.answers.map((a) => `Hỏi: ${a.question}\nĐáp: ${scrubProtected(a.answer)}`).join("\n\n");
  const r = await generateWithOpenClaw({
    workspaceId: c.ws, purpose: "hiring_screen", kind: "engine", module: "hiring", responseFormat: "json", timeoutMs: 75_000,
    messages: [
      { role: "system", content: SCREEN_SYSTEM },
      { role: "user", content: `TIÊU CHÍ CÔNG VIỆC\n${criteriaText(job)}\n\nKẾT QUẢ ĐỐI CHIẾU TỰ ĐỘNG (điểm ${s.score}/100)\n${lines || "(không có tiêu chí để chấm)"}\n\nCÂU TRẢ LỜI CỦA ỨNG VIÊN\n${answers || "(chưa có)"}\n\nLịch có thể làm: ${scrubProtected(cand.availability) || "(chưa ghi)"}` },
    ],
  });
  if (r.ok) {
    const o = parseLooseJson(r.output);
    if (typeof o?.summary === "string") summary = scrubProtected(o.summary.trim()).slice(0, 700) || null;
    if (Array.isArray(o?.interview_questions)) questions = (o.interview_questions as Array<unknown>).filter((x): x is string => typeof x === "string" && findFairnessViolations(x).length === 0).slice(0, 3);
  }
  const text = [summary ?? "Chưa có tóm tắt từ OpenClaw: điểm bên dưới là kết quả đối chiếu tiêu chí.", questions.length ? `Gợi ý câu hỏi phỏng vấn:\n${questions.map((q) => `- ${q}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
  return {
    proposal: {
      ...item.proposal,
      summary: `Sàng lọc ${cand.name}: ${s.score}/100 (${SCORE_LABEL[s.label]}) cho "${job.title}"`,
      draft: text, outcome: "clear",
      fields: { candidate_id: cand.id, job_id: job.id, score: s.score, label: s.label, reasons: JSON.stringify(s.reasons), ai_summary: summary, questions: JSON.stringify(questions) },
    },
  };
};

/** perform of screen_candidate: store the advisory score and reasons. It never rejects: applied -> screening is the only stage change. */
export const performScreening = async (c: EngineCtx, item: WorkItem, p: { fields: Record<string, string | number | null> }, by: { name: string }): Promise<Performed> => {
  const f = p.fields;
  const candidateId = String(f.candidate_id ?? "");
  const cand = await loadCandidate(c.db, c.ws, candidateId);
  const reasons = JSON.parse(String(f.reasons ?? "[]")) as Array<ScoreReason>;
  const label = String(f.label ?? "consider") as ScoreLabel;
  const score = Math.max(0, Math.min(100, Math.round(Number(f.score ?? 0))));
  const summary = [typeof f.ai_summary === "string" ? f.ai_summary : "", ...(() => {
    try {
      const q = JSON.parse(String(f.questions ?? "[]")) as Array<string>;
      return q.length ? [`Gợi ý câu hỏi phỏng vấn:\n${q.map((x) => `- ${x}`).join("\n")}`] : [];
    } catch { return []; }
  })()].filter(Boolean).join("\n\n") || null;
  const patch: Record<string, unknown> = { score, score_label: label, score_reasons: reasons, score_summary: summary, screened_at: new Date().toISOString() };
  if (cand.stage === "applied") {
    patch.stage = "screening";
    patch.stage_changed_at = new Date().toISOString();
  }
  const up = await c.db.from("hiring_candidates").update(patch).eq("id", cand.id).eq("workspace_id", c.ws);
  if (up.error) throw new Error(up.error.message);
  await logCandidate(c.db, c.ws, cand.id, "screened", by.name, `Sàng lọc theo tiêu chí: ${score}/100 (${SCORE_LABEL[label]}). Điểm chỉ để tham khảo; việc loại do người quyết định.`);
  return { summary: `${cand.name}: ${score}/100 (${SCORE_LABEL[label]})`, evidence: "captured", href: href(cand.id), detail: summary };
};

/* ------------------------------------------------------------------ availability and slots */

export type AvailabilityRow = { weekday: number; start_min: number; end_min: number };
export const DEFAULT_WINDOWS: ReadonlyArray<AvailabilityRow> = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_min: 9 * 60, end_min: 17 * 60 }));

/** Up to `count` slots in the next `horizonDays` days: one per day first (earliest free), then second slots. Times are Vietnam time. */
export const computeSlots = (
  windows: ReadonlyArray<AvailabilityRow>, busy: ReadonlyArray<Slot>, durationMin: number, now: Date, count = 3, horizonDays = 14,
): Array<Slot> => {
  const busyMs = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
  const earliest = now.getTime() + 2 * 3_600_000;
  const days: Array<Array<Slot>> = [];
  for (let d = 0; d <= horizonDays; d++) {
    const p = vnParts(new Date(now.getTime() + d * 86_400_000));
    const list: Array<Slot> = [];
    for (const w of windows.filter((x) => x.weekday === p.weekday)) {
      for (let m = w.start_min; m + durationMin <= w.end_min; m += 30) {
        const start = vnInstant(p.y, p.m, p.day, m);
        const end = new Date(start.getTime() + durationMin * 60_000);
        if (start.getTime() < earliest) continue;
        if (busyMs.some(([a, b]) => start.getTime() < b && end.getTime() > a)) continue;
        list.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }
    if (list.length) days.push(list);
  }
  const picked: Array<Slot> = [];
  for (let round = 0; picked.length < count && round < 3; round++) {
    for (const list of days) {
      const idx = round === 0 ? 0 : Math.min(list.length - 1, Math.floor(list.length / (round + 1)));
      const s = list[idx];
      if (s && !picked.some((x) => x.start === s.start)) picked.push(s);
      if (picked.length >= count) break;
    }
  }
  return picked.sort((a, b) => a.start.localeCompare(b.start));
};

const loadMemberName = async (db: Db, ws: string, userId: string): Promise<string> =>
  ((await db.from("workspace_members").select("display_name").eq("workspace_id", ws).eq("user_id", userId).maybeSingle()).data as { display_name: string } | null)?.display_name ?? "";

/** The person who interviews: the chosen member, else the workspace owner. */
const resolveInterviewer = async (db: Db, ws: string, userId: string | null): Promise<{ userId: string; name: string }> => {
  if (userId) {
    const name = await loadMemberName(db, ws, userId);
    if (!name) throw new HiringError("Người phỏng vấn phải là thành viên của doanh nghiệp.");
    return { userId, name };
  }
  const o = (await db.from("workspace_members").select("user_id, display_name").eq("workspace_id", ws).eq("status", "active").order("role", { ascending: false }).order("created_at").limit(20)).data as Array<{ user_id: string; display_name: string }> | null;
  const owner = ((await db.from("workspaces").select("owner_id").eq("id", ws).maybeSingle()).data as { owner_id: string } | null)?.owner_id;
  const hit = o?.find((m) => m.user_id === owner) ?? o?.[0];
  if (!hit) throw new HiringError("Chưa có người phỏng vấn: hãy chọn một thành viên.");
  return { userId: hit.user_id, name: hit.display_name };
};

/* ------------------------------------------------------------------ schedule_interview */

export type InterviewRequest = { readonly interviewerUserId: string | null; readonly mode: "in_person" | "online"; readonly location: string; readonly durationMin: number };

export const requestInterview = async (ws: string, candidateId: string, r: InterviewRequest): Promise<WorkItem> => {
  const db = hdb();
  const cand = await loadCandidate(db, ws, candidateId);
  if (["rejected", "withdrawn", "hired"].includes(cand.stage)) throw new HiringError(`Ứng viên đang ở "${STAGE_LABEL[cand.stage]}", không xếp lịch phỏng vấn được.`);
  const open = await db.from("hiring_interviews").select("id").eq("candidate_id", candidateId).in("status", ["proposed", "confirmed"]).limit(1);
  if (open.data?.length) throw new HiringError("Ứng viên đã có một lịch phỏng vấn đang mở. Hủy lịch đó trước nếu muốn xếp lại.");
  const who = await resolveInterviewer(db, ws, r.interviewerUserId);
  const loc = r.location.trim().slice(0, 300);
  if (r.mode === "online" && !loc) throw new HiringError("Phỏng vấn online cần có đường dẫn cuộc họp.");
  return runWork(hiringCtx(ws), {
    action: "schedule_interview", subject_type: "inbound", subject_id: candidateId, origin: "live", preset: true, noChain: true,
    dedupeKey: `schedule_interview:${candidateId}:${randomUUID().slice(0, 8)}`,
    seed: {
      summary: `Xếp lịch phỏng vấn cho ${cand.name}`,
      fields: { candidate_id: candidateId, interviewer_user_id: who.userId, interviewer_name: who.name, mode: r.mode, location: loc, duration_min: Math.max(15, Math.min(180, r.durationMin || 30)), contact: contactOf(cand) },
    },
  });
};

/** perform of schedule_interview: propose slots from the interviewer's availability and send them to the candidate. */
export const performInterview = async (c: EngineCtx, item: WorkItem, p: { fields: Record<string, string | number | null> }, by: { name: string }): Promise<Performed> => {
  const f = p.fields;
  const cand = await loadCandidate(c.db, c.ws, String(f.candidate_id));
  const job = await loadJob(c.db, c.ws, cand.job_id);
  const interviewerId = String(f.interviewer_user_id ?? "");
  const duration = Number(f.duration_min) || 30;
  const avail = ((await c.db.from("hiring_availability").select("weekday, start_min, end_min").eq("workspace_id", c.ws).eq("member_user_id", interviewerId)).data ?? []) as Array<AvailabilityRow>;
  const usedDefault = avail.length === 0;
  const busyRows = ((await c.db.from("hiring_interviews").select("slot_start, slot_end, proposed_slots, status").eq("workspace_id", c.ws).eq("interviewer_user_id", interviewerId).in("status", ["proposed", "confirmed"])).data ?? []) as Array<Pick<InterviewRow, "slot_start" | "slot_end" | "proposed_slots" | "status">>;
  const busy: Array<Slot> = busyRows.flatMap((b) => (b.status === "confirmed" && b.slot_start && b.slot_end ? [{ start: b.slot_start, end: b.slot_end }] : b.proposed_slots));
  const slots = computeSlots(usedDefault ? DEFAULT_WINDOWS : avail, busy, duration, new Date());
  if (!slots.length) throw new HiringError("Người phỏng vấn chưa có giờ rảnh trong 14 ngày tới. Hãy thêm lịch rảnh ở Thiết lập rồi thử lại.");
  const token = randomUUID().replace(/-/g, "");
  const ins = await c.db.from("hiring_interviews").insert({
    workspace_id: c.ws, candidate_id: cand.id, job_id: job.id, interviewer_user_id: interviewerId || null, interviewer_name: String(f.interviewer_name ?? ""), mode: f.mode === "online" ? "online" : "in_person",
    location: String(f.location ?? "") || job.location, duration_min: duration, proposed_slots: slots, token, work_item_id: item.id,
  }).select("*").single();
  if (ins.error) throw new Error(ins.error.message);
  const iv = ins.data as InterviewRow;
  if (["applied", "screening", "shortlisted"].includes(cand.stage)) await c.db.from("hiring_candidates").update({ stage: "interview", stage_changed_at: new Date().toISOString() }).eq("id", cand.id);
  const link = `${siteUrl()}/j/lich/${token}`;
  const shop = await company(c.db, c.ws);
  const where = iv.mode === "online" ? "online" : "trực tiếp";
  const text = [
    `Chào ${cand.name}, cảm ơn bạn đã ứng tuyển vị trí ${job.title} tại ${shop}.`,
    `Bên mình mời bạn phỏng vấn ${where}${iv.location ? ` (${iv.location})` : ""}, khoảng ${duration} phút. Các giờ đề xuất:`,
    ...slots.map((s) => `- ${fmtVnDateTime(s.start)}`),
    `Bạn chọn một giờ phù hợp tại đây: ${link}`,
    "Nếu không giờ nào hợp, bạn bấm \"Không có giờ phù hợp\" trên trang đó, bên mình sẽ đề xuất lại.",
  ].join("\n");
  const d = await notifyCandidate(c.db, c.ws, cand, { subject: `Mời phỏng vấn: ${job.title}`, text, workItemId: item.id });
  await logCandidate(c.db, c.ws, cand.id, "interview_proposed", by.name, `Đề xuất ${slots.length} giờ phỏng vấn với ${iv.interviewer_name || "người phỏng vấn"}${usedDefault ? " (dùng khung 9h-17h vì người phỏng vấn chưa khai báo lịch rảnh)" : ""}. ${d.note}`);
  return { summary: `Đã đề xuất ${slots.length} giờ phỏng vấn cho ${cand.name}. ${d.note}`, evidence: "captured", href: href(cand.id), detail: d.delivered ? null : link };
};

/** The candidate opens their link: the interview with the job title and shop, or null. */
export const loadInterviewByToken = async (db: Db, token: string): Promise<{ iv: InterviewRow; cand: Pick<CandidateRow, "id" | "name">; job: Pick<JobRow, "title">; shop: string } | null> => {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const iv = (await db.from("hiring_interviews").select("*").eq("token", token).maybeSingle()).data as InterviewRow | null;
  if (!iv) return null;
  const cand = (await db.from("hiring_candidates").select("id, name").eq("id", iv.candidate_id).maybeSingle()).data as Pick<CandidateRow, "id" | "name"> | null;
  const job = (await db.from("hiring_jobs").select("title").eq("id", iv.job_id).maybeSingle()).data as Pick<JobRow, "title"> | null;
  if (!cand || !job) return null;
  return { iv, cand, job, shop: await company(db, iv.workspace_id) };
};

/** The candidate picks one of the proposed times (or says none fits). A pick confirms the interview; a second click does nothing. */
export const pickInterviewSlot = async (db: Db, token: string, startIso: string | null): Promise<{ ok: boolean; message: string; interview?: InterviewRow }> => {
  const hit = await loadInterviewByToken(db, token);
  if (!hit) return { ok: false, message: "Đường dẫn này không còn hiệu lực." };
  const { iv, cand, job } = hit;
  if (iv.status === "confirmed") return { ok: true, message: "Lịch đã được xác nhận.", interview: iv };
  if (iv.status !== "proposed") return { ok: false, message: "Lịch này đã đóng. Vui lòng liên hệ doanh nghiệp." };
  if (startIso === null) {
    await db.from("hiring_interviews").update({ note: "Ứng viên báo không có giờ phù hợp" }).eq("id", iv.id);
    await logCandidate(db, iv.workspace_id, cand.id, "interview_declined_slots", cand.name, "Báo không có giờ nào phù hợp");
    await postOffice(db, iv.workspace_id, `${cand.name} báo không có giờ phỏng vấn nào phù hợp (${job.title}). Hãy hủy lịch cũ và đề xuất lại ở Tuyển dụng > Lịch phỏng vấn.`);
    return { ok: true, message: "Đã báo cho doanh nghiệp. Họ sẽ đề xuất giờ khác." };
  }
  const slot = iv.proposed_slots.find((s) => s.start === startIso);
  if (!slot) return { ok: false, message: "Giờ này không nằm trong các giờ được đề xuất." };
  const up = await db.from("hiring_interviews").update({ status: "confirmed", slot_start: slot.start, slot_end: slot.end, note: "" }).eq("id", iv.id).eq("status", "proposed").select("*").maybeSingle();
  if (up.error) throw new Error(up.error.message);
  if (!up.data) return { ok: false, message: "Lịch này vừa được cập nhật, vui lòng tải lại trang." };
  await logCandidate(db, iv.workspace_id, cand.id, "interview_confirmed", cand.name, `Chọn giờ phỏng vấn: ${fmtVnDateTime(slot.start)}`);
  await postOffice(db, iv.workspace_id, `${cand.name} đã xác nhận phỏng vấn "${job.title}" lúc ${fmtVnDateTime(slot.start)}${iv.interviewer_name ? ` với ${iv.interviewer_name}` : ""}.`);
  return { ok: true, message: `Đã xác nhận: ${fmtVnDateTime(slot.start)}.`, interview: up.data as InterviewRow };
};

export const setInterviewStatus = async (db: Db, ws: string, id: string, status: "done" | "cancelled" | "no_show", actor: string): Promise<void> => {
  const up = await db.from("hiring_interviews").update({ status }).eq("id", id).eq("workspace_id", ws).select("candidate_id").maybeSingle();
  if (up.error) throw new Error(up.error.message);
  if (!up.data) throw new HiringError("Không tìm thấy lịch phỏng vấn.");
  await logCandidate(db, ws, (up.data as { candidate_id: string }).candidate_id, `interview_${status}`, actor, status === "done" ? "Đã phỏng vấn xong" : status === "cancelled" ? "Hủy lịch phỏng vấn" : "Ứng viên không đến");
};

/* ------------------------------------------------------------------ send_offer */

export const OFFER_DAYS = 7;

/** The terms of an offer as plain lines, always written by code from what the owner entered (never by a model). */
const termsBlock = (job: JobRow, t: OfferTerms): string =>
  [
    "Điều khoản:",
    `- Vị trí: ${t.title || job.title} (${EMPLOYMENT_LABEL[job.employment_type]})`,
    `- Thu nhập: ${t.pay || fmtPay(job.pay_min_vnd, job.pay_max_vnd, job.pay_unit)}`,
    t.start_date ? `- Ngày bắt đầu: ${t.start_date}` : "", t.probation ? `- Thử việc: ${t.probation}` : "", job.location ? `- Nơi làm việc: ${job.location}` : "",
    t.note ? `- Ghi chú: ${t.note}` : "", `- Thư mời có hiệu lực ${OFFER_DAYS} ngày kể từ khi gửi`,
  ].filter(Boolean).join("\n");

const composeOffer = (cand: CandidateRow, job: JobRow, t: OfferTerms, shop: string, opening: string | null, closing: string | null): string =>
  [
    opening ?? `Chào ${cand.name},

${shop} rất vui được mời bạn nhận vị trí ${t.title || job.title}.`, termsBlock(job, t),
    closing ?? "Bạn xem thư và trả lời giúp bên mình ở đường dẫn bên dưới nhé.", `Trân trọng,
${shop}`,
  ].join("\n\n");

export type OfferRequest = { readonly title: string; readonly pay: string; readonly start_date: string; readonly probation: string; readonly note: string };

/** Create the offer and put it through the gate: OpenClaw drafts the text, the owner approves, then it is sent. */
export const requestOffer = async (ws: string, candidateId: string, t: OfferRequest, userId: string | null): Promise<{ offer: OfferRow; item: WorkItem }> => {
  const db = hdb();
  const cand = await loadCandidate(db, ws, candidateId);
  if (["rejected", "withdrawn", "hired"].includes(cand.stage)) throw new HiringError(`Ứng viên đang ở "${STAGE_LABEL[cand.stage]}", không gửi thư mời được.`);
  const active = await db.from("hiring_offers").select("id").eq("candidate_id", candidateId).in("status", ["draft", "waiting", "sent"]).limit(1);
  if (active.data?.length) throw new HiringError("Ứng viên đã có một thư mời đang mở.");
  const terms: OfferTerms = { title: t.title.trim().slice(0, 140), pay: t.pay.trim().slice(0, 200), start_date: t.start_date.trim().slice(0, 60), probation: t.probation.trim().slice(0, 100), note: t.note.trim().slice(0, 600) };
  if (!terms.pay) throw new HiringError("Hãy nhập mức thu nhập trong thư mời.");
  const bad = findFairnessViolations(`${terms.title} ${terms.note}`);
  if (bad.length) throw new HiringError(`Thư mời không nên nhắc tới ${bad[0].label}.`, bad);
  const token = randomUUID().replace(/-/g, "");
  const ins = await db.from("hiring_offers").insert({ workspace_id: ws, candidate_id: candidateId, job_id: cand.job_id, terms, status: "draft", token, created_by: userId }).select("*").single();
  if (ins.error) throw new Error(ins.error.message);
  const offer = ins.data as OfferRow;
  const item = await runWork(hiringCtx(ws), {
    action: "send_offer", subject_type: "inbound", subject_id: candidateId, origin: "live", noChain: true, dedupeKey: `send_offer:${offer.id}`,
    seed: { summary: `Gửi thư mời nhận việc cho ${cand.name}`, fields: { candidate_id: candidateId, offer_id: offer.id, contact: contactOf(cand) } },
  });
  const status = item.status === "waiting_decision" ? "waiting" : item.status === "done" ? "sent" : "draft";
  const up = await db.from("hiring_offers").update({ work_item_id: item.id, ...(status === "waiting" ? { status } : {}) }).eq("id", offer.id).select("*").single();
  return { offer: (up.data ?? offer) as OfferRow, item };
};

/** prepare of send_offer: OpenClaw writes only the greeting and the closing (one call); the terms (pay, start date...) are put in by code from what the owner entered, so the letter can never drift from them. */
export const prepareOffer = async (c: EngineCtx, item: WorkItem): Promise<Prepared> => {
  const offer = (await c.db.from("hiring_offers").select("*").eq("id", String(item.proposal.fields?.offer_id ?? "")).eq("workspace_id", c.ws).maybeSingle()).data as OfferRow | null;
  if (!offer) throw new HiringError("Không tìm thấy thư mời.");
  const cand = await loadCandidate(c.db, c.ws, offer.candidate_id);
  const job = await loadJob(c.db, c.ws, offer.job_id);
  const shop = await company(c.db, c.ws);
  const settings = await ensureSettings(c.db, c.ws);
  const r = await generateWithOpenClaw({
    workspaceId: c.ws, purpose: "hiring_offer", kind: "engine", module: "hiring", responseFormat: "json", timeoutMs: 75_000,
    messages: [
      { role: "system", content: `Bạn viết phần mở đầu và phần kết cho một thư mời nhận việc bằng tiếng Việt của một doanh nghiệp nhỏ. Các điều khoản (lương, ngày bắt đầu...) do hệ thống chèn ở giữa, KHÔNG nêu chúng và KHÔNG nêu con số nào. Không hứa thêm điều gì. Không nhắc tới giới tính, tuổi, tôn giáo, dân tộc, hôn nhân, thai sản, khuyết tật, quê quán. Giọng điệu: ${settings.ad_tone}. Văn bản thuần, không markdown. Trả về DUY NHẤT JSON: {"opening": string, "closing": string}. opening: lời chào "Chào <tên ứng viên>," rồi 1-2 câu nói doanh nghiệp vui được mời bạn nhận vị trí (nêu tên doanh nghiệp và vị trí), kết thúc bằng một câu dẫn vào phần điều khoản. closing: 1-2 câu mời xem thư và trả lời ở đường dẫn bên dưới (hệ thống thêm đường dẫn).` },
      { role: "user", content: `Doanh nghiệp: ${shop}
Ứng viên: ${cand.name}
Vị trí: ${offer.terms.title || job.title}` },
    ],
  });
  const o = r.ok ? parseLooseJson(r.output) : null;
  // the model's two paragraphs must be plain words: no figures, no markdown, nothing about protected traits
  const clean = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.replace(/\*\*?|__|#+ /g, "").trim();
    return t.length >= 15 && t.length <= 700 && !/\d/.test(t) && findFairnessViolations(t).length === 0 ? t : null;
  };
  const opening = clean(o?.opening);
  const closing = clean(o?.closing);
  const usedAi = opening !== null && closing !== null;
  const draft = composeOffer(cand, job, offer.terms, shop, opening, closing);
  return {
    proposal: {
      ...item.proposal, summary: `Gửi thư mời nhận việc cho ${cand.name} (${offer.terms.title || job.title}, ${offer.terms.pay})${usedAi ? "" : " - bản nháp mẫu, OpenClaw chưa soạn được"}`, draft,
      fields: { ...item.proposal.fields, candidate_id: cand.id, offer_id: offer.id, contact: contactOf(cand) }, outcome: "clear",
    },
  };
};

/** perform of send_offer (after approval): send the letter with the candidate's reply link. */
export const performOffer = async (c: EngineCtx, item: WorkItem, p: { draft?: string; fields: Record<string, string | number | null> }, by: { name: string }): Promise<Performed> => {
  const offer = (await c.db.from("hiring_offers").select("*").eq("id", String(p.fields.offer_id)).eq("workspace_id", c.ws).maybeSingle()).data as OfferRow | null;
  if (!offer) throw new HiringError("Không tìm thấy thư mời.");
  const cand = await loadCandidate(c.db, c.ws, offer.candidate_id);
  const job = await loadJob(c.db, c.ws, offer.job_id);
  const body = (p.draft ?? "").trim() || composeOffer(cand, job, offer.terms, await company(c.db, c.ws), null, null);
  const link = `${siteUrl()}/j/thu/${offer.token}`;
  const text = `${body}\n\nXem và trả lời thư mời tại: ${link}`;
  const d = await notifyCandidate(c.db, c.ws, cand, { subject: `Thư mời nhận việc: ${offer.terms.title || job.title}`, text, workItemId: item.id });
  const expires = new Date(Date.now() + OFFER_DAYS * 86_400_000).toISOString();
  await c.db.from("hiring_offers").update({ draft: body, status: "sent", sent_at: new Date().toISOString(), expires_at: expires, sent_via: d.via }).eq("id", offer.id);
  if (!["hired", "rejected", "withdrawn"].includes(cand.stage)) await c.db.from("hiring_candidates").update({ stage: "offer", stage_changed_at: new Date().toISOString() }).eq("id", cand.id);
  await logCandidate(c.db, c.ws, cand.id, "offer_sent", by.name, `Thư mời đã được duyệt bởi ${by.name}. ${d.note}`);
  return { summary: `Đã gửi thư mời cho ${cand.name}. ${d.note}`, evidence: "captured", href: href(cand.id), detail: d.delivered ? null : link };
};

export const cancelOfferOnReject = async (c: EngineCtx, p: { fields: Record<string, string | number | null> }, by: { name: string }): Promise<void> => {
  const id = String(p.fields.offer_id ?? "");
  const up = await c.db.from("hiring_offers").update({ status: "cancelled" }).eq("id", id).eq("workspace_id", c.ws).in("status", ["draft", "waiting"]).select("candidate_id").maybeSingle();
  if (up.data) await logCandidate(c.db, c.ws, (up.data as { candidate_id: string }).candidate_id, "offer_cancelled", by.name, "Thư mời không được duyệt");
};

export const loadOfferByToken = async (db: Db, token: string): Promise<{ offer: OfferRow; cand: Pick<CandidateRow, "id" | "name">; job: Pick<JobRow, "title" | "location">; shop: string } | null> => {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const offer = (await db.from("hiring_offers").select("*").eq("token", token).maybeSingle()).data as OfferRow | null;
  if (!offer || offer.status === "draft" || offer.status === "waiting" || offer.status === "cancelled") return null;
  const cand = (await db.from("hiring_candidates").select("id, name").eq("id", offer.candidate_id).maybeSingle()).data as Pick<CandidateRow, "id" | "name"> | null;
  const job = (await db.from("hiring_jobs").select("title, location").eq("id", offer.job_id).maybeSingle()).data as Pick<JobRow, "title" | "location"> | null;
  if (!cand || !job) return null;
  return { offer, cand, job, shop: await company(db, offer.workspace_id) };
};

export const ONBOARDING_ITEMS: ReadonlyArray<string> = [
  "Gọi hoặc nhắn xác nhận ngày đi làm đầu tiên",
  "Nhận giấy tờ cần thiết (CCCD, thông tin liên hệ khẩn cấp, tài khoản nhận lương)",
  "Ký thỏa thuận hoặc hợp đồng lao động",
  "Tạo hồ sơ nhân viên và xếp vào lịch làm",
  "Hướng dẫn nội quy, an toàn và cách làm việc",
  "Cấp đồng phục, thẻ hoặc tài khoản làm việc",
  "Giao người kèm cặp tuần đầu",
];

/** The candidate answers the offer. Accepting makes them hired, adds the onboarding checklist and tells the Office; declining records it. */
export const answerOffer = async (db: Db, token: string, accept: boolean): Promise<{ ok: boolean; message: string }> => {
  const hit = await loadOfferByToken(db, token);
  if (!hit) return { ok: false, message: "Đường dẫn này không còn hiệu lực." };
  const { offer, cand, job } = hit;
  if (offer.status === "accepted") return { ok: true, message: "Bạn đã đồng ý thư mời này. Doanh nghiệp sẽ liên hệ với bạn." };
  if (offer.status === "declined") return { ok: true, message: "Bạn đã từ chối thư mời này." };
  if (offer.status !== "sent") return { ok: false, message: "Thư mời này đã hết hiệu lực. Vui lòng liên hệ doanh nghiệp." };
  if (offer.expires_at && Date.parse(offer.expires_at) < Date.now()) {
    await db.from("hiring_offers").update({ status: "expired" }).eq("id", offer.id).eq("status", "sent");
    return { ok: false, message: "Thư mời này đã hết hạn. Vui lòng liên hệ doanh nghiệp." };
  }
  const up = await db.from("hiring_offers").update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() }).eq("id", offer.id).eq("status", "sent").select("id").maybeSingle();
  if (!up.data) return { ok: false, message: "Thư mời vừa được cập nhật, vui lòng tải lại trang." };
  const ws = offer.workspace_id;
  if (accept) {
    await db.from("hiring_candidates").update({ stage: "hired", stage_changed_at: new Date().toISOString() }).eq("id", cand.id);
    await db.from("hiring_onboarding").insert(ONBOARDING_ITEMS.map((title, i) => ({ workspace_id: ws, candidate_id: cand.id, title, sort: i })));
    await logCandidate(db, ws, cand.id, "offer_accepted", cand.name, "Đồng ý thư mời, chuyển sang Đã nhận");
    await postOffice(db, ws, `${cand.name} đã đồng ý thư mời "${job.title}". Việc cần làm khi nhận việc đã có sẵn ở Tuyển dụng > Nhận việc.`);
    await closeJobIfFilled(db, ws, offer.job_id);
    return { ok: true, message: "Cảm ơn bạn! Bạn đã đồng ý thư mời, doanh nghiệp sẽ liên hệ về ngày đi làm." };
  }
  await db.from("hiring_candidates").update({ stage: "withdrawn", stage_changed_at: new Date().toISOString() }).eq("id", cand.id);
  await logCandidate(db, ws, cand.id, "offer_declined", cand.name, "Từ chối thư mời");
  await postOffice(db, ws, `${cand.name} đã từ chối thư mời "${job.title}".`);
  return { ok: true, message: "Cảm ơn bạn đã phản hồi. Chúc bạn nhiều thành công." };
};

/** Close a job once enough people have said yes (when the shop asked for it). */
export const closeJobIfFilled = async (db: Db, ws: string, jobId: string): Promise<boolean> => {
  const s = await ensureSettings(db, ws);
  if (!s.auto_close_when_filled) return false;
  const job = (await db.from("hiring_jobs").select("id, title, headcount, status").eq("id", jobId).eq("workspace_id", ws).maybeSingle()).data as Pick<JobRow, "id" | "title" | "headcount" | "status"> | null;
  if (!job || job.status === "closed") return false;
  const { count } = await db.from("hiring_candidates").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("stage", "hired");
  if ((count ?? 0) < job.headcount) return false;
  await db.from("hiring_jobs").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", jobId);
  await postOffice(db, ws, `Tin "${job.title}" đã đủ người (${count}/${job.headcount}) nên NIVO đã đóng tin.`);
  return true;
};

/* ------------------------------------------------------------------ chat intake (the shop's chatbot channel) */

/** Open jobs the chatbot may take applications for: the block appended to the chat turn context. Empty when nothing is open for chat. */
export const hiringChatBrief = async (db: Db, ws: string): Promise<string> => {
  const jobs = ((await db.from("hiring_jobs").select("*").eq("workspace_id", ws).eq("status", "open").contains("channels", ["chat"]).order("created_at").limit(5)).data ?? []) as Array<JobRow>;
  if (!jobs.length) return "";
  const open = jobs.filter((j) => !(j.closes_at && Date.parse(j.closes_at) < Date.now()));
  if (!open.length) return "";
  return `\n\n[OPEN JOBS] ${HIRING_APPLICATION_CLAUSE}Add this key to your JSON reply: ${HIRING_APPLICATION_SHAPE}\nViệc đang tuyển (mã việc là "job"):\n${open.map((j) => {
    const qs = j.questions.map((q) => `    ${q.id}${q.required ? "*" : ""}: ${q.text}${q.type === "choice" && q.choices?.length ? ` (chọn: ${q.choices.join(" / ")})` : ""}`).join("\n");
    return `- job="${j.slug}": ${j.title}; ${EMPLOYMENT_LABEL[j.employment_type]}; ${fmtPay(j.pay_min_vnd, j.pay_max_vnd, j.pay_unit)}; ${j.location || "nơi làm chưa ghi"}; ${j.schedule || ""}\n  Yêu cầu: ${criteriaText(j).split("\n").slice(1).join("; ") || "(không nêu)"}\n  Câu hỏi (dấu * là bắt buộc):\n${qs || "    (không có)"}`;
  }).join("\n")}`;
};

/** A candidate who applied through the chat (the model proposed `application`; this validates it again): stored with consent, then screened. Never throws. */
export const registerChatApplication = async (ws: string, conversationId: string, app: ChatApplication): Promise<{ ok: boolean; message: string; candidateId?: string }> => {
  const db = hdb();
  try {
    const job = (await db.from("hiring_jobs").select("*").eq("workspace_id", ws).eq("slug", app.job).maybeSingle()).data as JobRow | null;
    if (!job || !job.channels.includes("chat")) return { ok: false, message: "Không tìm thấy việc này." };
    const settings = await ensureSettings(db, ws);
    const r = await submitApplication(db, {
      ws, job, source: "chat", name: app.name, phone: app.phone, email: app.email, availability: app.availability, answers: app.answers, consent: app.consent,
      consentText: settings.apply_consent_text, ipHash: null, conversationId,
    });
    if (!r.duplicate) await startScreening(ws, r.candidate.id);
    return { ok: true, message: r.duplicate ? "Hồ sơ đã có trước đó." : "Đã ghi nhận hồ sơ.", candidateId: r.candidate.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
};

/** Run queued hiring steps of one workspace (screening after an application). */
export const drainHiring = (ws: string, limit = 3): Promise<number> => runQueued(hiringCtx(ws), limit);

export { publicJobUrl };
