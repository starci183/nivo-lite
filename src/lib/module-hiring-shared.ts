/**
 * Hiring ("Tuyển dụng"): types and pure rules shared by the server, the public apply page and the workbench. No server imports here.
 *   - the fairness validator: a job may never ask for (or screen on) gender, age, religion, ethnicity, marital status, pregnancy, disability, hometown or looks;
 *   - the deterministic screening checklist: scores a candidate against the written requirements ONLY; advisory, never a rejection;
 *   - small helpers (slug, phone, Vietnam time).
 */

/* ------------------------------------------------------------------ vocabulary */

export const STAGES = ["applied", "screening", "shortlisted", "interview", "offer", "hired", "rejected", "withdrawn"] as const;
export type Stage = (typeof STAGES)[number];
export const isStage = (v: unknown): v is Stage => typeof v === "string" && (STAGES as ReadonlyArray<string>).includes(v);
/** The lanes of the pipeline board (rejected and withdrawn sit in one closed lane). */
export const BOARD_STAGES: ReadonlyArray<Stage> = ["applied", "screening", "shortlisted", "interview", "offer", "hired", "rejected"];

export const STAGE_LABEL: Readonly<Record<Stage, string>> = {
  applied: "Mới ứng tuyển", screening: "Đang xét", shortlisted: "Vào danh sách", interview: "Phỏng vấn", offer: "Thư mời", hired: "Đã nhận", rejected: "Đã loại", withdrawn: "Ứng viên rút",
};

export const JOB_STATUSES = ["draft", "open", "paused", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const JOB_STATUS_LABEL: Readonly<Record<JobStatus, string>> = { draft: "Nháp", open: "Đang tuyển", paused: "Tạm dừng", closed: "Đã đóng" };

export type EmploymentType = "full_time" | "part_time";
export const EMPLOYMENT_LABEL: Readonly<Record<EmploymentType, string>> = { full_time: "Toàn thời gian", part_time: "Bán thời gian" };
export type PayUnit = "month" | "hour" | "shift";
export const PAY_UNIT_LABEL: Readonly<Record<PayUnit, string>> = { month: "tháng", hour: "giờ", shift: "ca" };

export type QuestionType = "text" | "yesno" | "number" | "choice";
export type JobQuestion = {
  readonly id: string;
  readonly text: string;
  readonly type: QuestionType;
  readonly required: boolean;
  readonly choices?: ReadonlyArray<string>;
  /** yesno: "yes" | "no"; number: the minimum; choice: the accepted choices. Absent = just collected, not scored. */
  readonly expect?: "yes" | "no" | number | ReadonlyArray<string>;
};
export type JobRequirements = {
  readonly skills: ReadonlyArray<string>;
  readonly experience_years: number | null;
  readonly experience_note: string;
  readonly availability: ReadonlyArray<string>;
  readonly must_have: ReadonlyArray<string>;
  readonly nice_to_have: ReadonlyArray<string>;
};
export const EMPTY_REQUIREMENTS: JobRequirements = { skills: [], experience_years: null, experience_note: "", availability: [], must_have: [], nice_to_have: [] };

export type JobRow = {
  id: string; workspace_id: string; slug: string; title: string; position: string; employment_type: EmploymentType; schedule: string;
  pay_min_vnd: number | null; pay_max_vnd: number | null; pay_unit: PayUnit; location: string; headcount: number; description: string;
  requirements: JobRequirements; questions: ReadonlyArray<JobQuestion>; status: JobStatus; channels: ReadonlyArray<string>;
  ad_variants: AdVariants | null; closes_at: string | null; created_at: string; updated_at: string;
};
export type AdVariants = { facebook: string; zalo: string; topcv: string; generated_at: string; ms: number };

export type Answer = { readonly question_id: string; readonly question: string; readonly answer: string };
export type ReasonStatus = "met" | "unmet" | "unknown";
export type ScoreReason = { readonly criterion: string; readonly status: ReasonStatus; readonly note: string };
export type ScoreLabel = "fit" | "consider" | "not_fit";
export const SCORE_LABEL: Readonly<Record<ScoreLabel, string>> = { fit: "Phù hợp", consider: "Cân nhắc", not_fit: "Chưa phù hợp" };

export type CandidateRow = {
  id: string; workspace_id: string; job_id: string; name: string; phone: string; email: string; source: "page" | "chat" | "manual";
  conversation_id: string | null; cv_path: string | null; cv_name: string | null; cv_mime: string | null; cv_size: number | null;
  answers: ReadonlyArray<Answer>; availability: string; score: number | null; score_label: ScoreLabel | null; score_reasons: ReadonlyArray<ScoreReason>;
  score_summary: string | null; screened_at: string | null; stage: Stage; stage_changed_at: string; rejected_reason: string | null; notes: string;
  staff_id: string | null; created_at: string;
};

export type InterviewStatus = "proposed" | "confirmed" | "done" | "cancelled" | "no_show";
export const INTERVIEW_STATUS_LABEL: Readonly<Record<InterviewStatus, string>> = { proposed: "Chờ ứng viên chọn giờ", confirmed: "Đã xác nhận", done: "Đã phỏng vấn", cancelled: "Đã hủy", no_show: "Không đến" };
export type Slot = { readonly start: string; readonly end: string };
export type InterviewRow = {
  id: string; workspace_id: string; candidate_id: string; job_id: string; interviewer_user_id: string | null; interviewer_name: string; mode: "in_person" | "online";
  location: string; duration_min: number; proposed_slots: ReadonlyArray<Slot>; slot_start: string | null; slot_end: string | null; status: InterviewStatus;
  token: string; work_item_id: string | null; reminder_sent_at: string | null; note: string; created_at: string;
};

export type OfferStatus = "draft" | "waiting" | "sent" | "accepted" | "declined" | "expired" | "cancelled";
export const OFFER_STATUS_LABEL: Readonly<Record<OfferStatus, string>> = { draft: "Nháp", waiting: "Chờ bạn duyệt", sent: "Đã gửi, chờ trả lời", accepted: "Ứng viên đồng ý", declined: "Ứng viên từ chối", expired: "Hết hạn", cancelled: "Đã hủy" };
export type OfferTerms = { readonly title: string; readonly pay: string; readonly start_date: string; readonly probation: string; readonly note: string };
export type OfferRow = {
  id: string; workspace_id: string; candidate_id: string; job_id: string; terms: OfferTerms; draft: string; status: OfferStatus; token: string;
  work_item_id: string | null; sent_via: "email" | "chat" | "manual" | null; sent_at: string | null; expires_at: string | null; responded_at: string | null; created_at: string;
};

export type SettingsRow = {
  workspace_id: string; public_slug: string; retention_days: number; notify_new_candidate: boolean; remind_interview: boolean; auto_close_when_filled: boolean;
  apply_consent_text: string; ad_tone: string;
};

/* ------------------------------------------------------------------ text helpers */

/** Lower-case, no accents, đ -> d. */
export const fold = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

/** URL slug of a title: ascii, lower, dashes. */
export const slugify = (s: string, max = 60): string => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");

/** Slugs that are the app's own public pages and so never a workspace slug. */
export const RESERVED_SLUGS: ReadonlyArray<string> = ["lich", "thu", "api", "admin"];

/** A Vietnamese phone number: digits only, +84 -> 0; null when it cannot be one. */
export const normalizePhone = (raw: string): string | null => {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+84")) d = `0${d.slice(3)}`;
  else if (d.startsWith("84") && d.length >= 11) d = `0${d.slice(2)}`;
  d = d.replace(/\D/g, "");
  return /^0\d{9,10}$/.test(d) ? d : null;
};

export const EMAIL_RE = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]{2,}$/;

/* ------------------------------------------------------------------ Vietnam time (UTC+7, no DST) */

const VN_OFFSET_MS = 7 * 3_600_000;
/** The parts of an instant on the Vietnam clock. */
export const vnParts = (d: Date): { y: number; m: number; day: number; weekday: number; minute: number } => {
  const t = new Date(d.getTime() + VN_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), day: t.getUTCDate(), weekday: t.getUTCDay(), minute: t.getUTCHours() * 60 + t.getUTCMinutes() };
};
/** The instant of `minute` (from midnight) on the Vietnam calendar day y-m-day. */
export const vnInstant = (y: number, m: number, day: number, minute: number): Date => new Date(Date.UTC(y, m, day, 0, minute) - VN_OFFSET_MS);
export const fmtVnDateTime = (iso: string | Date): string => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = vnParts(d);
  const wd = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][p.weekday];
  const hh = String(Math.floor(p.minute / 60)).padStart(2, "0");
  const mm = String(p.minute % 60).padStart(2, "0");
  return `${wd}, ${hh}:${mm} ngày ${String(p.day).padStart(2, "0")}/${String(p.m + 1).padStart(2, "0")}/${p.y}`;
};
export const fmtVnDate = (iso: string | Date): string => {
  const p = vnParts(typeof iso === "string" ? new Date(iso) : iso);
  return `${String(p.day).padStart(2, "0")}/${String(p.m + 1).padStart(2, "0")}/${p.y}`;
};

export const fmtPay = (min: number | null, max: number | null, unit: PayUnit): string => {
  const f = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
  const u = PAY_UNIT_LABEL[unit];
  if (min && max) return min === max ? `${f(min)} đ/${u}` : `${f(min)} - ${f(max)} đ/${u}`;
  if (min) return `Từ ${f(min)} đ/${u}`;
  if (max) return `Đến ${f(max)} đ/${u}`;
  return "Thỏa thuận";
};

/* ------------------------------------------------------------------ fairness: no screening on protected traits */

export type FairnessCategory = "gender" | "age" | "religion" | "ethnicity" | "marital" | "pregnancy" | "disability" | "hometown" | "appearance";
export type FairnessViolation = { readonly category: FairnessCategory; readonly label: string; readonly excerpt: string; readonly field: string };

export const FAIRNESS_LABEL: Readonly<Record<FairnessCategory, string>> = {
  gender: "giới tính", age: "độ tuổi", religion: "tôn giáo", ethnicity: "dân tộc", marital: "tình trạng hôn nhân", pregnancy: "thai sản",
  disability: "khuyết tật hoặc sức khỏe", hometown: "quê quán", appearance: "ngoại hình",
};

/** The one sentence under every refusal: what to write instead. */
export const FAIRNESS_ADVICE = "NIVO không dùng giới tính, tuổi, tôn giáo, dân tộc, tình trạng hôn nhân, thai sản, khuyết tật, quê quán hay ngoại hình để sàng lọc. Hãy viết yêu cầu theo kỹ năng, kinh nghiệm hoặc lịch làm việc.";

type Rule = { readonly category: FairnessCategory; readonly on: "lower" | "fold"; readonly re: RegExp };
const W = (alt: string, flags = "u") => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, flags);
const G = (alt: string) => new RegExp(alt, "gu");

const RULES: ReadonlyArray<Rule> = [
  // gender: "nữ" (not "nữ trang"), pairs and cues for "nam" (never plain "Việt Nam" / "miền Nam" / "5 năm")
  { category: "gender", on: "lower", re: new RegExp("(?<![\\p{L}\\p{N}])(?:nữ(?! trang)|phụ nữ|đàn ông|con gái|con trai|phái nữ|phái nam|nữ giới|nam giới|giới tính|female|male)(?![\\p{L}\\p{N}])", "gu") },
  { category: "gender", on: "lower", re: new RegExp("(?<![\\p{L}\\p{N}])(?:nhận|ưu tiên|yêu cầu|chỉ|cần|tuyển|là|ứng viên|bạn)\\s+nam(?![\\p{L}\\p{N}])", "gu") },
  { category: "gender", on: "lower", re: new RegExp("(?<![\\p{L}\\p{N}])nam\\s*(?:/|,|-|hoặc|và)\\s*nữ|(?<![\\p{L}\\p{N}])nam\\s+(?:từ|dưới|trên|cao|\\d|tuổi|độc thân|sinh|khỏe|mạnh)", "gu") },
  { category: "gender", on: "fold", re: new RegExp("(?<![a-z0-9])(?:nu(?! trang)|gioi tinh|nam gioi|nu gioi|phu nu|dan ong|con gai|con trai)(?![a-z0-9])", "g") },
  // age (legal minimum "đủ 18 tuổi" is allowed: see AGE_OK below)
  { category: "age", on: "fold", re: new RegExp("(\\d{2})\\s*(?:-|~|den|toi)\\s*(\\d{2})\\s*tuoi", "g") },
  { category: "age", on: "fold", re: new RegExp("(?:(duoi|tren|tu|du|khong qua|khong vuot qua|toi da|toi thieu|it nhat|under|over)\\s*)?(\\d{2})\\s*tuoi", "g") },
  { category: "age", on: "fold", re: new RegExp("(?<![a-z])(?:do tuoi|tuoi tu|tuoi duoi|tuoi tren|sinh nam\\s*\\d{4}|(?:19|20)\\d{2}\\s*tro (?:ve sau|lai))", "g") },
  { category: "age", on: "fold", re: new RegExp("(?<![a-z])(?:tre trung|tre khoe|con tre|lon tuoi|trung nien|tuoi tre|qua tuoi)(?![a-z])", "g") },
  { category: "religion", on: "fold", re: new RegExp("(?<![a-z])(?:ton giao|cong giao|thien chua|phat giao|dao phat|tin lanh|hoi giao|khong theo dao|theo dao|phat tu|co doc giao|ki to giao)(?![a-z])", "g") },
  { category: "ethnicity", on: "fold", re: new RegExp("(?<![a-z])(?:dan toc|nguoi kinh|nguoi hoa|chung toc|mau da)(?![a-z])", "g") },
  { category: "marital", on: "fold", re: new RegExp("(?<![a-z])(?:doc than|da ket hon|chua ket hon|ket hon|chua co gia dinh|da co gia dinh|lap gia dinh|tinh trang hon nhan|hon nhan|co con nho|chua co con|da co con|so con|ly hon|ly di|chua co chong|chua co vo)(?![a-z])", "g") },
  { category: "pregnancy", on: "fold", re: new RegExp("(?<![a-z])(?:mang thai|co thai|co bau|mang bau|dang bau|ke hoach sinh con|du dinh sinh con|dinh sinh con|sinh con)(?![a-z])", "g") },
  { category: "disability", on: "fold", re: new RegExp("(?<![a-z])(?:khuyet tat|tan tat|di tat|di dang|benh man tinh|tien su benh|hiv)(?![a-z])", "g") },
  { category: "hometown", on: "fold", re: new RegExp("(?<![a-z])(?:que quan|noi sinh|ho khau|nguoi goc|nguoi dia phuong|nguoi mien (?:bac|trung|nam)|nguoi (?:ha noi|sai gon|hue|da nang))(?![a-z])", "g") },
  { category: "appearance", on: "fold", re: new RegExp("(?<![a-z])(?:ngoai hinh|ua nhin|xinh dep|xinh xan|dep trai|chieu cao|can nang|cao 1m\\d{0,2}|cao \\d{3} ?cm)(?![a-z])", "g") },
];

/** Position map from the folded string back to the original (one folded char per original char, so excerpts quote the writer's own words). */
const foldMapped = (s: string): { readonly folded: string; readonly map: ReadonlyArray<number> } => {
  let folded = "";
  const map: Array<number> = [];
  let i = 0;
  for (const ch of s) {
    const f = ch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    for (const c of f) {
      folded += c;
      map.push(i);
    }
    i += ch.length;
  }
  map.push(i);
  return { folded, map };
};

/** "tu 18 tuoi", "du 16 tuoi", "18 tuoi tro len" is the legal minimum working age, never a screening criterion. */
const isLegalMinimumAge = (prefix: string | undefined, n: number, after: string): boolean =>
  [15, 16, 18].includes(n) && ((prefix === "tu" || prefix === "du" || prefix === "toi thieu" || prefix === "it nhat") || /^\s*tro len/.test(after));

/** Every place a text asks for, or screens on, a protected trait. Empty = fine. `field` names where it was found (for the message). */
export const findFairnessViolations = (text: string, field = ""): Array<FairnessViolation> => {
  const out: Array<FairnessViolation> = [];
  const lower = text.toLowerCase().normalize("NFC");
  const { folded, map } = foldMapped(text.normalize("NFC"));
  const hasMarks = lower !== folded;
  const seen = new Set<string>();
  const add = (category: FairnessCategory, start: number, end: number, onFold: boolean) => {
    const o0 = onFold ? map[start] : start;
    const o1 = onFold ? map[Math.min(end, map.length - 1)] : end;
    const excerpt = text.slice(Math.max(0, o0 - 12), Math.min(text.length, o1 + 18)).replace(/\s+/g, " ").trim();
    const key = `${category}:${o0}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ category, label: FAIRNESS_LABEL[category], excerpt, field });
  };
  for (const rule of RULES) {
    const hay = rule.on === "fold" ? folded : lower;
    // plain "nam" cues only make sense with diacritics (without them "5 nam kinh nghiem" is a year count)
    if (rule.on === "lower" && !hasMarks && rule.category === "gender") continue;
    for (const m of hay.matchAll(rule.re)) {
      if (rule.category === "age" && rule.on === "fold" && m[2] && /^\d{2}$/.test(m[2]) && !m[1]?.match(/^\d/)) {
        // second age rule: prefix in m[1], number in m[2]
        const n = Number(m[2]);
        const after = hay.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12);
        if (isLegalMinimumAge(m[1], n, after)) continue;
      }
      add(rule.category, m.index ?? 0, (m.index ?? 0) + m[0].length, rule.on === "fold");
    }
  }
  return out;
};

export type JobDraftTexts = {
  readonly title: string; readonly position?: string; readonly description: string; readonly schedule?: string;
  readonly requirements: JobRequirements; readonly questions: ReadonlyArray<JobQuestion>;
};

/** Run the validator over every text a job puts in front of candidates or uses to screen them. */
export const validateJobDraft = (j: JobDraftTexts): Array<FairnessViolation> => {
  const out: Array<FairnessViolation> = [];
  const check = (field: string, text: string | undefined) => {
    if (text && text.trim()) out.push(...findFairnessViolations(text, field));
  };
  check("Tên tin", j.title);
  check("Vị trí", j.position);
  check("Mô tả", j.description);
  check("Lịch làm", j.schedule);
  check("Kinh nghiệm", j.requirements.experience_note);
  for (const s of j.requirements.skills) check("Kỹ năng", s);
  for (const s of j.requirements.availability) check("Lịch làm việc", s);
  for (const s of j.requirements.must_have) check("Yêu cầu bắt buộc", s);
  for (const s of j.requirements.nice_to_have) check("Điểm cộng", s);
  for (const q of j.questions) {
    check("Câu hỏi", q.text);
    for (const c of q.choices ?? []) check("Lựa chọn của câu hỏi", c);
  }
  return out;
};

/** The refusal shown to the owner: what was found, where, and what to write instead. */
export const fairnessMessage = (v: ReadonlyArray<FairnessViolation>): string => {
  const parts = v.slice(0, 4).map((x) => `${x.field ? `${x.field}: ` : ""}"${x.excerpt}" (${x.label})`);
  return `Tin tuyển dụng có yêu cầu có thể phân biệt đối xử: ${parts.join("; ")}${v.length > 4 ? ` và ${v.length - 4} chỗ khác` : ""}. ${FAIRNESS_ADVICE}`;
};

/** Candidate text for the screening AI with every sentence that touches a protected trait removed (a candidate may volunteer them; they are never read). */
export const scrubProtected = (text: string): string =>
  text.split(/(?<=[.!?\n;])\s+/).filter((s) => findFairnessViolations(s).length === 0).join(" ").trim();

/* ------------------------------------------------------------------ deterministic screening checklist */

const has = (hay: string, needle: string): boolean => {
  const n = fold(needle).trim();
  return n.length > 0 && new RegExp(`(?<![a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(hay);
};

const parseYesNo = (a: string): "yes" | "no" | null => {
  const f = fold(a).trim();
  if (/^(co|vang|da|ok|yes|y|duoc|dong y|co a|co ah|roi)\b/.test(f)) return "yes";
  if (/^(khong|ko|k|no|n|chua|khong co|khong duoc)\b/.test(f)) return "no";
  return null;
};
const firstNumber = (a: string): number | null => {
  const m = a.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
/** "2 năm", "18 tháng", "6 months": the longest stated experience, in years. */
const experienceYears = (text: string): number | null => {
  let best: number | null = null;
  for (const m of fold(text).replace(/,/g, ".").matchAll(/(\d+(?:\.\d+)?)\s*(nam|thang|year|month)/g)) {
    const v = Number(m[1]) / (m[2] === "thang" || m[2] === "month" ? 12 : 1);
    best = best === null ? v : Math.max(best, v);
  }
  return best;
};

export type Screening = { readonly score: number; readonly label: ScoreLabel; readonly reasons: ReadonlyArray<ScoreReason>; readonly determinable: number };

/**
 * Score one candidate against the job's WRITTEN requirements only (skills, experience, availability, must-haves, scored questions).
 * Nothing about the person (name, phone, source, anything protected) is read. Advisory: a low score never rejects anybody.
 *   met +weight, unmet 0, unknown 0 (the CV is not read: not mentioned means "chưa thấy", not "không có").
 *   Only an explicit "no" / too-low number makes an item unmet, and only unmet must-haves make the label "Chưa phù hợp" on their own.
 */
export const screenAgainstRequirements = (job: Pick<JobRow, "requirements" | "questions">, c: { readonly answers: ReadonlyArray<Answer>; readonly availability: string }): Screening => {
  const reasons: Array<ScoreReason> = [];
  let total = 0;
  let met = 0;
  let unmetMust = 0;
  let unknown = 0;
  const text = fold(c.answers.map((a) => scrubProtected(a.answer)).join(" \n "));
  const push = (criterion: string, status: ReasonStatus, note: string, weight: number, must: boolean) => {
    total += weight;
    if (status === "met") met += weight;
    else if (status === "unmet" && must) unmetMust += 1;
    else if (status === "unknown") unknown += 1;
    reasons.push({ criterion, status, note });
  };

  for (const q of job.questions) {
    if (q.expect === undefined) continue;
    const a = c.answers.find((x) => x.question_id === q.id)?.answer?.trim() ?? "";
    const w = q.required ? 2 : 1;
    const label = q.text.length > 80 ? `${q.text.slice(0, 77)}...` : q.text;
    if (!a) { push(label, "unknown", "Chưa trả lời.", w, q.required); continue; }
    if (q.type === "yesno") {
      const v = parseYesNo(a);
      if (v === null) push(label, "unknown", `Trả lời: "${a.slice(0, 80)}" (chưa rõ có hay không).`, w, q.required);
      else if (v === q.expect) push(label, "met", v === "yes" ? "Trả lời: có." : "Trả lời: không (đúng điều kiện).", w, q.required);
      else push(label, "unmet", v === "yes" ? "Trả lời: có (cần: không)." : "Trả lời: không (cần: có).", w, q.required);
    } else if (q.type === "number" && typeof q.expect === "number") {
      const n = firstNumber(a);
      if (n === null) push(label, "unknown", `Trả lời: "${a.slice(0, 80)}" (không thấy con số).`, w, q.required);
      else if (n >= q.expect) push(label, "met", `${n} (cần từ ${q.expect}).`, w, q.required);
      else push(label, "unmet", `${n} (cần từ ${q.expect}).`, w, q.required);
    } else if (q.type === "choice" && Array.isArray(q.expect)) {
      const ok = (q.expect as ReadonlyArray<string>).some((e) => fold(e) === fold(a) || has(fold(a), e));
      push(label, ok ? "met" : "unmet", ok ? `Chọn: ${a.slice(0, 60)}.` : `Chọn: ${a.slice(0, 60)} (cần: ${(q.expect as ReadonlyArray<string>).join(", ")}).`, w, q.required);
    }
  }

  for (const s of job.requirements.skills) {
    if (!s.trim()) continue;
    push(`Kỹ năng: ${s}`, has(text, s) ? "met" : "unknown", has(text, s) ? "Ứng viên có nhắc tới trong câu trả lời." : "Chưa thấy ứng viên nhắc tới (CV chưa được đọc tự động).", 2, false);
  }
  const needYears = job.requirements.experience_years;
  if (needYears !== null && needYears > 0 && !job.questions.some((q) => q.type === "number" && /kinh nghi[eệ]m/i.test(q.text) && q.expect !== undefined)) {
    const got = experienceYears(text);
    if (got === null) push(`Kinh nghiệm từ ${needYears} năm`, "unknown", "Chưa thấy ứng viên nói số năm kinh nghiệm.", 2, false);
    else if (got >= needYears) push(`Kinh nghiệm từ ${needYears} năm`, "met", `Ứng viên nêu khoảng ${Math.round(got * 10) / 10} năm.`, 2, false);
    else push(`Kinh nghiệm từ ${needYears} năm`, "unmet", `Ứng viên nêu khoảng ${Math.round(got * 10) / 10} năm.`, 2, false);
  }
  if (job.requirements.availability.length) {
    const av = fold(`${c.availability} ${text}`);
    const hits = job.requirements.availability.filter((x) => has(av, x));
    if (!c.availability.trim() && hits.length === 0) push(`Lịch làm: ${job.requirements.availability.join(", ")}`, "unknown", "Chưa ghi lịch có thể làm.", 2, false);
    else if (hits.length) push(`Lịch làm: ${job.requirements.availability.join(", ")}`, "met", `Có thể làm: ${hits.join(", ")}.`, 2, false);
    else push(`Lịch làm: ${job.requirements.availability.join(", ")}`, "unmet", `Ứng viên ghi: ${c.availability.slice(0, 80)}.`, 2, false);
  }
  const tokens = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  for (const [list, w, mustFlag] of [[job.requirements.must_have, 2, true], [job.requirements.nice_to_have, 1, false]] as const) {
    for (const item of list) {
      const t = tokens(item);
      if (!t.length) continue;
      const ok = t.filter((x) => text.includes(x)).length / t.length >= 0.6;
      push(`${mustFlag ? "Bắt buộc" : "Điểm cộng"}: ${item}`, ok ? "met" : "unknown", ok ? "Ứng viên có nhắc tới." : "Chưa thấy ứng viên nhắc tới.", w, false);
    }
  }

  const determinable = reasons.length - unknown;
  const score = total === 0 ? 0 : Math.round((100 * met) / total);
  const label: ScoreLabel = total === 0 ? "consider" : unmetMust > 0 || (score < 30 && unknown / Math.max(1, reasons.length) < 0.5) ? "not_fit" : score >= 70 ? "fit" : "consider";
  return { score, label, reasons, determinable };
};

/** A short plain description of the criteria (what the AI is told to compare against). */
export const criteriaText = (job: Pick<JobRow, "title" | "requirements" | "questions" | "employment_type" | "schedule" | "location">): string => {
  const r = job.requirements;
  return [
    `Vị trí: ${job.title} (${EMPLOYMENT_LABEL[job.employment_type]}${job.schedule ? `, ${job.schedule}` : ""}${job.location ? `, ${job.location}` : ""})`,
    r.skills.length ? `Kỹ năng: ${r.skills.join(", ")}` : "",
    r.experience_years ? `Kinh nghiệm: từ ${r.experience_years} năm${r.experience_note ? ` (${r.experience_note})` : ""}` : r.experience_note ? `Kinh nghiệm: ${r.experience_note}` : "",
    r.availability.length ? `Lịch làm: ${r.availability.join(", ")}` : "",
    r.must_have.length ? `Bắt buộc: ${r.must_have.join("; ")}` : "",
    r.nice_to_have.length ? `Điểm cộng: ${r.nice_to_have.join("; ")}` : "",
  ].filter(Boolean).join("\n");
};

/** Parse and clean a job's requirements/questions from loose input (a form, a model). */
const strList = (v: unknown, max = 40, len = 200): Array<string> => (Array.isArray(v) ? v : []).map((x) => (typeof x === "string" ? x.trim().slice(0, len) : "")).filter(Boolean).slice(0, max);
export const cleanRequirements = (v: unknown): JobRequirements => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const years = typeof o.experience_years === "number" && Number.isFinite(o.experience_years) && o.experience_years >= 0 ? Math.min(50, o.experience_years) : null;
  return {
    skills: strList(o.skills), experience_years: years, experience_note: typeof o.experience_note === "string" ? o.experience_note.trim().slice(0, 300) : "",
    availability: strList(o.availability, 20, 80), must_have: strList(o.must_have), nice_to_have: strList(o.nice_to_have),
  };
};
export const cleanQuestions = (v: unknown): Array<JobQuestion> => {
  const out: Array<JobQuestion> = [];
  for (const raw of Array.isArray(v) ? v : []) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as Record<string, unknown>;
    const text = typeof q.text === "string" ? q.text.trim().slice(0, 240) : "";
    if (!text) continue;
    const type: QuestionType = q.type === "yesno" || q.type === "number" || q.type === "choice" ? q.type : "text";
    const choices = type === "choice" ? strList(q.choices, 12, 80) : undefined;
    let expect: JobQuestion["expect"];
    if (type === "yesno" && (q.expect === "yes" || q.expect === "no")) expect = q.expect;
    else if (type === "number" && typeof q.expect === "number" && Number.isFinite(q.expect)) expect = q.expect;
    else if (type === "choice" && Array.isArray(q.expect)) expect = strList(q.expect, 12, 80);
    out.push({ id: typeof q.id === "string" && /^[a-z0-9_-]{1,24}$/i.test(q.id) ? q.id : `q${out.length + 1}`, text, type, required: q.required !== false, ...(choices?.length ? { choices } : {}), ...(expect !== undefined ? { expect } : {}) });
  }
  return out.slice(0, 12);
};
