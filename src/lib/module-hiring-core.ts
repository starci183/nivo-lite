import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWithOpenClaw } from "./openclaw-generate";
import { supabaseAdmin } from "./supabase/admin";
import {
  EMAIL_RE, EMPLOYMENT_LABEL, FAIRNESS_ADVICE, STAGE_LABEL, cleanQuestions, cleanRequirements, findFairnessViolations, fairnessMessage, fmtPay, isStage, normalizePhone, RESERVED_SLUGS, slugify,
  validateJobDraft, type AdVariants, type Answer, type CandidateRow, type FairnessViolation, type JobRow, type SettingsRow, type Stage,
} from "./module-hiring-shared";

/**
 * Hiring core (server): settings, jobs, the job ad, applications (public page and chat), stage moves, deletion.
 * Every function takes the workspace id explicitly and writes with the service role; callers (server actions, the public routes, performers) have
 * already established who the workspace is. Candidate personal data never leaves Supabase: CVs are in the private `hiring` bucket.
 */
export type Db = SupabaseClient;
export const hdb = (): Db => supabaseAdmin();

/** An error whose message is plain Vietnamese for the person who caused it; `violations` is set when the fairness check refused the text. */
export class HiringError extends Error {
  constructor(message: string, readonly violations: ReadonlyArray<FairnessViolation> = []) {
    super(message);
  }
}

export const siteUrl = (): string => (process.env.NEXT_PUBLIC_SITE_URL || "https://nivo.vn").replace(/\/+$/, "");
const must = <T>(res: { data: T | null; error: { message: string } | null }, what = "Không tìm thấy dữ liệu"): T => {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new HiringError(what);
  return res.data;
};

/* ------------------------------------------------------------------ settings */

export const ensureSettings = async (db: Db, ws: string): Promise<SettingsRow> => {
  const got = await db.from("hiring_settings").select("*").eq("workspace_id", ws).maybeSingle();
  if (got.error) throw new Error(got.error.message);
  if (got.data) return got.data as SettingsRow;
  const name = ((await db.from("workspaces").select("name").eq("id", ws).maybeSingle()).data as { name: string } | null)?.name ?? "doanh nghiep";
  let base = slugify(name, 40) || "doanh-nghiep";
  if (base.length < 3) base = `${base}-vn`;
  if (RESERVED_SLUGS.includes(base)) base = `${base}-hr`;
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const ins = await db.from("hiring_settings").insert({ workspace_id: ws, public_slug: slug }).select("*").single();
    if (!ins.error) return ins.data as SettingsRow;
    if (ins.error.code === "23505") {
      // either the slug is taken, or another request just created this workspace's row
      const again = await db.from("hiring_settings").select("*").eq("workspace_id", ws).maybeSingle();
      if (again.data) return again.data as SettingsRow;
      continue;
    }
    throw new Error(ins.error.message);
  }
  throw new Error("Không tạo được đường dẫn công khai cho doanh nghiệp.");
};

export type SettingsInput = { readonly public_slug?: string; readonly retention_days?: number; readonly notify_new_candidate?: boolean; readonly remind_interview?: boolean;
  readonly auto_close_when_filled?: boolean; readonly apply_consent_text?: string; readonly ad_tone?: string };

export const saveSettings = async (db: Db, ws: string, input: SettingsInput): Promise<SettingsRow> => {
  await ensureSettings(db, ws);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.public_slug !== undefined) {
    const s = slugify(input.public_slug, 60);
    if (s.length < 3) throw new HiringError("Đường dẫn công khai cần ít nhất 3 chữ cái hoặc số.");
    if (RESERVED_SLUGS.includes(s)) throw new HiringError("Đường dẫn này dành riêng cho hệ thống, hãy chọn tên khác.");
    patch.public_slug = s;
  }
  if (input.retention_days !== undefined) {
    if (!Number.isInteger(input.retention_days) || input.retention_days < 7 || input.retention_days > 730) throw new HiringError("Thời hạn lưu hồ sơ phải từ 7 đến 730 ngày.");
    patch.retention_days = input.retention_days;
  }
  for (const k of ["notify_new_candidate", "remind_interview", "auto_close_when_filled"] as const) if (typeof input[k] === "boolean") patch[k] = input[k];
  if (input.apply_consent_text !== undefined) {
    const t = input.apply_consent_text.trim();
    if (t.length < 20 || t.length > 800) throw new HiringError("Lời đồng ý cần từ 20 đến 800 ký tự.");
    patch.apply_consent_text = t;
  }
  if (input.ad_tone !== undefined) patch.ad_tone = input.ad_tone.trim().slice(0, 200) || "thân thiện, rõ ràng, tôn trọng";
  const up = await db.from("hiring_settings").update(patch).eq("workspace_id", ws).select("*").single();
  if (up.error) throw new HiringError(up.error.code === "23505" ? "Đường dẫn này đã có người dùng, hãy chọn tên khác." : up.error.message);
  return up.data as SettingsRow;
};

/* ------------------------------------------------------------------ jobs */

export type JobInput = {
  readonly id?: string; readonly title: string; readonly position?: string; readonly employment_type?: string; readonly schedule?: string;
  readonly pay_min_vnd?: number | null; readonly pay_max_vnd?: number | null; readonly pay_unit?: string; readonly location?: string; readonly headcount?: number;
  readonly description?: string; readonly requirements?: unknown; readonly questions?: unknown; readonly channels?: ReadonlyArray<string>; readonly closes_at?: string | null;
};

const money = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

/** Create or update a job. Every text is checked for protected traits first: a refusal carries the exact words and what to write instead. */
export const saveJob = async (db: Db, ws: string, userId: string | null, input: JobInput): Promise<JobRow> => {
  const title = input.title.trim();
  if (title.length < 3 || title.length > 140) throw new HiringError("Tên tin tuyển dụng cần từ 3 đến 140 ký tự.");
  const requirements = cleanRequirements(input.requirements);
  const questions = cleanQuestions(input.questions);
  const description = (input.description ?? "").trim().slice(0, 6000);
  const min = money(input.pay_min_vnd);
  const max = money(input.pay_max_vnd);
  if (min !== null && max !== null && min > max) throw new HiringError("Mức lương thấp nhất không được lớn hơn mức cao nhất.");
  const violations = validateJobDraft({ title, position: input.position, description, schedule: input.schedule, requirements, questions });
  if (violations.length) throw new HiringError(fairnessMessage(violations), violations);
  const channels = (input.channels ?? ["page", "chat"]).filter((c) => c === "page" || c === "chat");
  const row = {
    title, position: (input.position ?? "").trim().slice(0, 120), employment_type: input.employment_type === "part_time" ? "part_time" : "full_time",
    schedule: (input.schedule ?? "").trim().slice(0, 300), pay_min_vnd: min, pay_max_vnd: max, pay_unit: ["hour", "shift"].includes(input.pay_unit ?? "") ? input.pay_unit : "month",
    location: (input.location ?? "").trim().slice(0, 300), headcount: Math.max(1, Math.min(500, Math.round(input.headcount ?? 1))), description, requirements, questions,
    channels: channels.length ? channels : ["page"], closes_at: input.closes_at ? new Date(input.closes_at).toISOString() : null, updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const up = await db.from("hiring_jobs").update(row).eq("id", input.id).eq("workspace_id", ws).select("*").maybeSingle();
    if (up.error) throw new Error(up.error.message);
    if (!up.data) throw new HiringError("Không tìm thấy tin tuyển dụng này.");
    return up.data as JobRow;
  }
  const base = slugify(title, 60) || "tuyen-dung";
  for (let i = 0; i < 30; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const ins = await db.from("hiring_jobs").insert({ ...row, workspace_id: ws, slug, created_by: userId }).select("*").single();
    if (!ins.error) return ins.data as JobRow;
    if (ins.error.code !== "23505") throw new Error(ins.error.message);
  }
  throw new Error("Không tạo được đường dẫn cho tin này.");
};

export const loadJob = async (db: Db, ws: string, id: string): Promise<JobRow> =>
  must(await db.from("hiring_jobs").select("*").eq("id", id).eq("workspace_id", ws).maybeSingle(), "Không tìm thấy tin tuyển dụng này.") as JobRow;

export const setJobStatus = async (db: Db, ws: string, id: string, status: "draft" | "open" | "paused" | "closed"): Promise<JobRow> => {
  const job = await loadJob(db, ws, id);
  if (status === "open") {
    // checked again at the door, so a row written another way can never go public with a discriminatory requirement
    const v = validateJobDraft({ title: job.title, position: job.position, description: job.description, schedule: job.schedule, requirements: job.requirements, questions: job.questions });
    if (v.length) throw new HiringError(fairnessMessage(v), v);
    if (!job.description.trim() && !job.requirements.skills.length && !job.requirements.must_have.length) throw new HiringError("Hãy mô tả công việc hoặc nêu yêu cầu trước khi mở tin.");
    await ensureSettings(db, ws);
  }
  const up = await db.from("hiring_jobs").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", ws).select("*").single();
  if (up.error) throw new Error(up.error.message);
  return up.data as JobRow;
};

export const publicJobUrl = (slug: string, jobSlug: string): string => `${siteUrl()}/j/${slug}/${jobSlug}`;

/* ------------------------------------------------------------------ the job ad (OpenClaw) */

const parseJsonLoose = (raw: string): Record<string, unknown> | null => {
  const body = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v: unknown = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const a = tryParse(body);
  if (a) return a;
  const s = body.indexOf("{");
  const e = body.lastIndexOf("}");
  return s >= 0 && e > s ? tryParse(body.slice(s, e + 1)) : null;
};
export const parseLooseJson = parseJsonLoose;

/** Drop every line that touches a protected trait (what is left is safe to show; a model must never be the last check). */
const stripUnfair = (text: string): string => text.split("\n").filter((l) => findFairnessViolations(l).length === 0).join("\n").trim();

export const jobFacts = (job: JobRow): string => {
  const r = job.requirements;
  return [
    `Tên tin: ${job.title}`, job.position ? `Vị trí: ${job.position}` : "", `Hình thức: ${EMPLOYMENT_LABEL[job.employment_type]}`, job.schedule ? `Lịch làm: ${job.schedule}` : "",
    `Mức lương: ${fmtPay(job.pay_min_vnd, job.pay_max_vnd, job.pay_unit)}`, job.location ? `Nơi làm việc: ${job.location}` : "", `Cần tuyển: ${job.headcount} người`,
    job.description ? `Mô tả: ${job.description}` : "", r.skills.length ? `Kỹ năng: ${r.skills.join(", ")}` : "",
    r.experience_years ? `Kinh nghiệm: từ ${r.experience_years} năm${r.experience_note ? ` (${r.experience_note})` : ""}` : r.experience_note ? `Kinh nghiệm: ${r.experience_note}` : "",
    r.availability.length ? `Lịch có thể làm: ${r.availability.join(", ")}` : "", r.must_have.length ? `Bắt buộc: ${r.must_have.join("; ")}` : "", r.nice_to_have.length ? `Điểm cộng: ${r.nice_to_have.join("; ")}` : "",
  ].filter(Boolean).join("\n");
};

const AD_SYSTEM = `Bạn viết tin tuyển dụng cho một doanh nghiệp nhỏ ở Việt Nam. Chỉ dùng thông tin được cung cấp: không bịa mức lương, quyền lợi, địa chỉ hay cam kết.
TUYỆT ĐỐI không nêu, không ngầm ưu tiên và không dùng làm tiêu chí: giới tính, độ tuổi, tôn giáo, dân tộc, tình trạng hôn nhân, thai sản, khuyết tật, quê quán, ngoại hình. Chỉ nói về kỹ năng, kinh nghiệm và lịch làm việc.
Trả về DUY NHẤT một đối tượng JSON, không thêm chữ nào khác: {"facebook": string, "zalo": string, "topcv": string}.
- facebook: bài đăng cho nhóm Facebook, 80-140 từ, mở đầu thu hút, vài emoji vừa phải, nêu lương và nơi làm, dòng cuối mời ứng tuyển.
- zalo: tin ngắn 40-70 từ cho nhóm Zalo, gạch đầu dòng ngắn, không emoji thừa.
- topcv: bài kiểu TopCV với các mục "Mô tả công việc", "Yêu cầu", "Quyền lợi", "Cách ứng tuyển". Nếu không có thông tin quyền lợi thì viết "Trao đổi cụ thể khi phỏng vấn".
Ở chỗ mời ứng tuyển, viết đúng ký hiệu {{link}} (hệ thống sẽ thay bằng đường dẫn thật).`;

export type AdResult = { readonly ads: AdVariants; readonly timings: Record<string, number>; readonly attempts: number; readonly sanitised: boolean };

/** Draft the job ad with OpenClaw: three copy-ready variants (Facebook group, Zalo, TopCV style). Records how long OpenClaw took. */
export const generateJobAd = async (db: Db, ws: string, jobId: string): Promise<AdResult> => {
  const job = await loadJob(db, ws, jobId);
  const settings = await ensureSettings(db, ws);
  const wsName = ((await db.from("workspaces").select("name").eq("id", ws).maybeSingle()).data as { name: string } | null)?.name ?? "";
  const link = publicJobUrl(settings.public_slug, job.slug);
  const user = `Doanh nghiệp: ${wsName}\nGiọng điệu: ${settings.ad_tone}\n\n${jobFacts(job)}`;
  const t0 = Date.now();
  let attempts = 0;
  let timings: Record<string, number> = {};
  let sanitised = false;
  let parsed: { facebook: string; zalo: string; topcv: string } | null = null;
  let feedback = "";
  while (attempts < 2 && !parsed) {
    attempts += 1;
    const r = await generateWithOpenClaw({
      workspaceId: ws, purpose: "hiring_job_ad", kind: "engine", module: "hiring", responseFormat: "json", timeoutMs: 100_000,
      messages: [{ role: "system", content: AD_SYSTEM }, { role: "user", content: user + feedback }],
    });
    if (!r.ok) throw new HiringError(r.message);
    timings = r.timings;
    const o = parseJsonLoose(r.output);
    const pick = (k: string) => (typeof o?.[k] === "string" ? (o[k] as string).trim() : "");
    const got = { facebook: pick("facebook"), zalo: pick("zalo"), topcv: pick("topcv") };
    if (!got.facebook || !got.zalo || !got.topcv) {
      feedback = "\n\nLần trước chưa đúng định dạng. Trả về đúng một JSON có đủ 3 khóa facebook, zalo, topcv.";
      continue;
    }
    const bad = [got.facebook, got.zalo, got.topcv].flatMap((t) => findFairnessViolations(t));
    if (bad.length && attempts < 2) {
      feedback = `\n\nBản trước có chỗ nhắc tới ${[...new Set(bad.map((b) => b.label))].join(", ")}. Viết lại, bỏ hoàn toàn các chi tiết đó.`;
      continue;
    }
    if (bad.length) {
      sanitised = true;
      parsed = { facebook: stripUnfair(got.facebook), zalo: stripUnfair(got.zalo), topcv: stripUnfair(got.topcv) };
    } else parsed = got;
  }
  if (!parsed) throw new HiringError("NIVO chưa soạn được tin, thử lại sau ít phút.");
  const fill = (t: string) => (t.includes("{{link}}") ? t.split("{{link}}").join(link) : `${t}\n\nỨng tuyển: ${link}`);
  const ads: AdVariants = { facebook: fill(parsed.facebook), zalo: fill(parsed.zalo), topcv: fill(parsed.topcv), generated_at: new Date().toISOString(), ms: Date.now() - t0 };
  const up = await db.from("hiring_jobs").update({ ad_variants: ads, updated_at: new Date().toISOString() }).eq("id", jobId).eq("workspace_id", ws);
  if (up.error) throw new Error(up.error.message);
  return { ads, timings, attempts, sanitised };
};

/* ------------------------------------------------------------------ timeline, Office, retention helpers */

export const logCandidate = async (db: Db, ws: string, candidateId: string, kind: string, actor: string, summary: string): Promise<void> => {
  await db.from("hiring_events").insert({ workspace_id: ws, candidate_id: candidateId, kind, actor, summary: summary.slice(0, 500) });
};

/** One short line in the Office thread from NIVO. */
export const postOffice = async (db: Db, ws: string, body: string, workItemId: string | null = null): Promise<void> => {
  await db.from("messages").insert({ workspace_id: ws, author_kind: "system", author_name: "NIVO", agent_id: null, body: body.slice(0, 1500), lead_id: null, work_item_id: workItemId });
};

export const loadCandidate = async (db: Db, ws: string, id: string): Promise<CandidateRow> =>
  must(await db.from("hiring_candidates").select("*").eq("id", id).eq("workspace_id", ws).maybeSingle(), "Không tìm thấy ứng viên này.") as CandidateRow;

/* ------------------------------------------------------------------ applications */

export const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_TYPES: ReadonlyArray<{ readonly mime: string; readonly ext: string; readonly magic: (b: Buffer) => boolean }> = [
  { mime: "application/pdf", ext: "pdf", magic: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", magic: (b) => b[0] === 0x50 && b[1] === 0x4b },
  { mime: "application/msword", ext: "doc", magic: (b) => b[0] === 0xd0 && b[1] === 0xcf },
  { mime: "image/jpeg", ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  { mime: "image/png", ext: "png", magic: (b) => b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG" },
];
/** The CV type from the file's own bytes (the browser's label is not trusted). */
export const detectCv = (bytes: Buffer): { mime: string; ext: string } | null => CV_TYPES.find((t) => t.magic(bytes)) ?? null;

export const hashIp = (ip: string): string => createHash("sha256").update(`${process.env.ENGINE_SHARED_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "nivo"}:hiring:${ip}`).digest("hex").slice(0, 32);

export type ApplicationInput = {
  readonly ws: string;
  readonly job: JobRow;
  readonly source: "page" | "chat" | "manual";
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly availability: string;
  readonly answers: ReadonlyArray<{ readonly question_id: string; readonly answer: string }>;
  readonly consent: boolean;
  readonly consentText: string;
  readonly ipHash: string | null;
  readonly cv?: { readonly bytes: Buffer; readonly name: string } | null;
  readonly conversationId?: string | null;
};
export type ApplicationResult = { readonly candidate: CandidateRow; readonly duplicate: boolean };

/** Validate and store one application. The same person applying twice for a job (same phone) is one application. */
export const submitApplication = async (db: Db, a: ApplicationInput): Promise<ApplicationResult> => {
  if (a.job.status !== "open") throw new HiringError("Tin tuyển dụng này hiện không nhận hồ sơ.");
  if (a.job.closes_at && Date.parse(a.job.closes_at) < Date.now()) throw new HiringError("Tin tuyển dụng này đã hết hạn nhận hồ sơ.");
  if (!a.consent) throw new HiringError("Bạn cần đồng ý để doanh nghiệp lưu hồ sơ thì mới nộp được.");
  const name = a.name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 120) throw new HiringError("Vui lòng nhập họ tên (từ 2 đến 120 ký tự).");
  const phone = a.phone.trim() ? normalizePhone(a.phone) : null;
  if (a.phone.trim() && !phone) throw new HiringError("Số điện thoại chưa đúng. Ví dụ: 0901234567.");
  const email = a.email.trim().toLowerCase();
  if (email && (!EMAIL_RE.test(email) || email.length > 254)) throw new HiringError("Email chưa đúng.");
  if (!phone && !email) throw new HiringError("Vui lòng cho biết số điện thoại hoặc email để doanh nghiệp liên hệ.");

  const answers: Array<Answer> = [];
  for (const q of a.job.questions) {
    const given = (a.answers.find((x) => x.question_id === q.id)?.answer ?? "").replace(/\r/g, "").trim().slice(0, 1000);
    if (!given && q.required) throw new HiringError(`Bạn chưa trả lời câu hỏi: "${q.text.slice(0, 80)}".`);
    if (given) answers.push({ question_id: q.id, question: q.text, answer: given });
  }

  if (phone) {
    const dup = await db.from("hiring_candidates").select("*").eq("job_id", a.job.id).eq("phone", phone).maybeSingle();
    if (dup.data) return { candidate: dup.data as CandidateRow, duplicate: true };
  }

  const id = randomUUID();
  let cv: { path: string; name: string; mime: string; size: number } | null = null;
  if (a.cv) {
    if (a.cv.bytes.length === 0) throw new HiringError("File CV bị trống.");
    if (a.cv.bytes.length > CV_MAX_BYTES) throw new HiringError("File CV lớn quá 5 MB. Hãy nén hoặc gửi bản nhẹ hơn.");
    const kind = detectCv(a.cv.bytes);
    if (!kind) throw new HiringError("CV chỉ nhận file PDF, Word (doc, docx), ảnh JPG hoặc PNG.");
    const safe = slugify(a.cv.name.replace(/\.[^.]+$/, ""), 40) || "cv";
    const path = `${a.ws}/${a.job.id}/${id}/${safe}.${kind.ext}`;
    const up = await db.storage.from("hiring").upload(path, a.cv.bytes, { contentType: kind.mime, upsert: false });
    if (up.error) throw new Error(`Không lưu được CV: ${up.error.message}`);
    cv = { path, name: `${safe}.${kind.ext}`, mime: kind.mime, size: a.cv.bytes.length };
  }

  const ins = await db.from("hiring_candidates").insert({
    id, workspace_id: a.ws, job_id: a.job.id, name, phone: phone ?? "", email, source: a.source, conversation_id: a.conversationId ?? null,
    cv_path: cv?.path ?? null, cv_name: cv?.name ?? null, cv_mime: cv?.mime ?? null, cv_size: cv?.size ?? null, answers, availability: a.availability.trim().slice(0, 300),
  }).select("*").single();
  if (ins.error) {
    if (cv) await db.storage.from("hiring").remove([cv.path]);
    if (ins.error.code === "23505") {
      const dup = await db.from("hiring_candidates").select("*").eq("job_id", a.job.id).eq("phone", phone ?? "").maybeSingle();
      if (dup.data) return { candidate: dup.data as CandidateRow, duplicate: true };
    }
    throw new Error(ins.error.message);
  }
  const cand = ins.data as CandidateRow;
  await db.from("hiring_consents").insert({ workspace_id: a.ws, candidate_id: id, channel: a.source, consent_text: a.consentText, ip_hash: a.ipHash });
  await logCandidate(db, a.ws, id, "applied", name, a.source === "chat" ? "Ứng tuyển qua chat" : a.source === "page" ? "Ứng tuyển qua trang tuyển dụng" : "Thêm thủ công");
  await logCandidate(db, a.ws, id, "consent", name, "Đã đồng ý để doanh nghiệp lưu hồ sơ");
  const settings = await ensureSettings(db, a.ws);
  if (settings.notify_new_candidate) await postOffice(db, a.ws, `Có ứng viên mới cho "${a.job.title}": ${name}${cv ? " (có CV)" : ""}. Xem ở Tuyển dụng > Ứng viên.`);
  return { candidate: cand, duplicate: false };
};

/* ------------------------------------------------------------------ rate limit of the public routes */

/** Count this hit and say whether the caller is over the limit (default 8 applications per hour per address). */
export const rateLimited = async (db: Db, ipHash: string, ws: string | null, limit = 8, kind = "apply"): Promise<boolean> => {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db.from("hiring_apply_hits").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).eq("kind", kind).gte("created_at", since);
  if ((count ?? 0) >= limit) return true;
  await db.from("hiring_apply_hits").insert({ ip_hash: ipHash, workspace_id: ws, kind });
  return false;
};

/* ------------------------------------------------------------------ stage moves, notes, deletion */

export const moveCandidate = async (db: Db, ws: string, id: string, stage: Stage, actor: string, reason?: string): Promise<CandidateRow> => {
  if (!isStage(stage)) throw new HiringError("Giai đoạn không hợp lệ.");
  const cur = await loadCandidate(db, ws, id);
  if (cur.stage === stage) return cur;
  if (stage === "hired") throw new HiringError("Ứng viên chuyển thành Đã nhận khi họ đồng ý thư mời, không kéo tay.");
  if (stage === "offer" && !(await db.from("hiring_offers").select("id").eq("candidate_id", id).limit(1)).data?.length)
    throw new HiringError("Hãy soạn thư mời ở thẻ ứng viên, thẻ sẽ tự vào cột Thư mời.");
  if (stage === "rejected" && (reason ?? "").trim().length < 3) throw new HiringError("Ghi lý do loại (ít nhất vài chữ, theo tiêu chí công việc) để lưu hồ sơ.");
  if (stage === "rejected") {
    const v = findFairnessViolations(reason ?? "");
    if (v.length) throw new HiringError(`Lý do loại không được dựa vào ${v[0].label}. ${FAIRNESS_ADVICE}`, v);
  }
  const up = await db.from("hiring_candidates").update({ stage, stage_changed_at: new Date().toISOString(), ...(stage === "rejected" ? { rejected_reason: reason!.trim().slice(0, 300) } : {}) })
    .eq("id", id).eq("workspace_id", ws).select("*").single();
  if (up.error) throw new Error(up.error.message);
  await logCandidate(db, ws, id, "stage", actor, `Chuyển sang "${STAGE_LABEL[stage]}"${stage === "rejected" ? `: ${reason!.trim().slice(0, 200)}` : ""}`);
  return up.data as CandidateRow;
};

export const saveNotes = async (db: Db, ws: string, id: string, notes: string, actor: string): Promise<void> => {
  const v = findFairnessViolations(notes);
  if (v.length) throw new HiringError(`Ghi chú không nên ghi ${v[0].label} của ứng viên: đánh giá chỉ dựa trên kỹ năng, kinh nghiệm và lịch làm việc.`, v);
  const up = await db.from("hiring_candidates").update({ notes: notes.slice(0, 4000) }).eq("id", id).eq("workspace_id", ws);
  if (up.error) throw new Error(up.error.message);
  await logCandidate(db, ws, id, "note", actor, "Cập nhật ghi chú");
};

/** Delete a candidate with every trace: the CV file, answers, consent, interviews, offers. Used by the owner (a candidate's request) and by retention. */
export const deleteCandidates = async (db: Db, ws: string, ids: ReadonlyArray<string>): Promise<{ candidates: number; files: number }> => {
  if (!ids.length) return { candidates: 0, files: 0 };
  const rows = ((await db.from("hiring_candidates").select("id, cv_path").eq("workspace_id", ws).in("id", [...ids])).data ?? []) as Array<{ id: string; cv_path: string | null }>;
  const paths = rows.flatMap((r) => (r.cv_path ? [r.cv_path] : []));
  if (paths.length) await db.storage.from("hiring").remove(paths);
  const del = await db.from("hiring_candidates").delete().eq("workspace_id", ws).in("id", rows.map((r) => r.id));
  if (del.error) throw new Error(del.error.message);
  return { candidates: rows.length, files: paths.length };
};

/** A short-lived link to look at a CV (private bucket). Caller has checked the candidate belongs to the workspace. */
export const cvSignedUrl = async (db: Db, ws: string, candidateId: string): Promise<{ url: string; name: string; mime: string } | null> => {
  const c = await loadCandidate(db, ws, candidateId);
  if (!c.cv_path) return null;
  const s = await db.storage.from("hiring").createSignedUrl(c.cv_path, 600);
  if (s.error || !s.data) return null;
  return { url: s.data.signedUrl, name: c.cv_name ?? "cv", mime: c.cv_mime ?? "application/pdf" };
};

/* ------------------------------------------------------------------ public job page data */

export type PublicJob = {
  readonly job: Pick<JobRow, "id" | "title" | "position" | "employment_type" | "schedule" | "pay_min_vnd" | "pay_max_vnd" | "pay_unit" | "location" | "description" | "requirements" | "questions" | "status" | "closes_at" | "headcount">;
  readonly company: string;
  readonly consentText: string;
  readonly workspaceId: string;
  readonly open: boolean;
};

/** The public face of a job: nothing internal (no expectations of the scored questions, no workspace data beyond the shop name). */
export const loadPublicJob = async (db: Db, wsSlug: string, jobSlug: string): Promise<PublicJob | null> => {
  const s = (await db.from("hiring_settings").select("workspace_id, apply_consent_text").eq("public_slug", wsSlug).maybeSingle()).data as { workspace_id: string; apply_consent_text: string } | null;
  if (!s) return null;
  const job = (await db.from("hiring_jobs").select("*").eq("workspace_id", s.workspace_id).eq("slug", jobSlug).maybeSingle()).data as JobRow | null;
  if (!job || job.status === "draft") return null;
  const company = ((await db.from("workspaces").select("name").eq("id", s.workspace_id).maybeSingle()).data as { name: string } | null)?.name ?? "";
  const open = job.status === "open" && job.channels.includes("page") && !(job.closes_at && Date.parse(job.closes_at) < Date.now());
  const questions = job.questions.map(({ expect: _expect, ...q }) => q) as unknown as JobRow["questions"];
  return {
    job: {
      id: job.id, title: job.title, position: job.position, employment_type: job.employment_type, schedule: job.schedule, pay_min_vnd: job.pay_min_vnd, pay_max_vnd: job.pay_max_vnd,
      pay_unit: job.pay_unit, location: job.location, description: job.description, requirements: job.requirements, questions, status: job.status, closes_at: job.closes_at, headcount: job.headcount,
    },
    company, consentText: s.apply_consent_text, workspaceId: s.workspace_id, open,
  };
};
