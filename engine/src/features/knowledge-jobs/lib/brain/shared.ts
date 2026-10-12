// GENERATED from src/lib/brain/shared.ts by engine/dev/sync-shared.mjs. Do not edit here: edit the web file and re-run the script.
/**
 * The second brain, client-safe part: shapes, trust per source, key normalisation and the agent view rules.
 *
 * ONE brain per workspace, many views. A fact lives once (one ACTIVE row per subject + attribute); each agent sees the part its
 * audience allows: a customer-facing agent (the chatbot) sees PUBLIC facts only, an internal agent sees public and internal facts, and a
 * RESTRICTED fact is seen only by the modules it names. Lessons (how to work) are per agent, or shared when module is null.
 */

export type SubjectType = "business" | "product" | "service" | "policy" | "customer" | "person" | "supplier" | "place" | "other"
export type Scope = "public" | "internal" | "restricted"
export type FactStatus = "proposed" | "scheduled" | "active" | "superseded" | "rejected" | "expired"
export type SourceKind = "owner" | "manager" | "document" | "system" | "staff" | "customer" | "ai"
export type LessonStatus = "proposed" | "active" | "retired" | "rejected"
export type LessonOrigin = "edits" | "note" | "outcome" | "manual"
export type Audience = "customer" | "internal"
export type ProposalKind = "set" | "retire"

export const SUBJECT_TYPES: ReadonlyArray<SubjectType> = ["business", "product", "service", "policy", "customer", "person", "supplier", "place", "other"]
export const SCOPES: ReadonlyArray<Scope> = ["public", "internal", "restricted"]

/** Where a piece of evidence came from; `ref` is the row id in its own table (or a URL for a document). */
export type Evidence = {
  readonly kind: "message" | "data_record" | "knowledge" | "decision" | "note" | "manual" | "document"
  readonly ref: string
  readonly label: string
  readonly quote?: string
  readonly at?: string
  readonly connectionId?: string
  /** Document evidence: the knowledge source it was read from and its title (`ref` and `label` carry the same two values). */
  readonly sourceId?: string
  readonly title?: string
}

export type Fact = {
  readonly id: string
  readonly subjectType: SubjectType
  readonly subjectKey: string
  readonly subjectLabel: string
  readonly attribute: string
  readonly attributeLabel: string
  readonly value: string
  readonly valueNumber: number | null
  readonly unit: string | null
  readonly scope: Scope
  readonly modules: ReadonlyArray<string>
  readonly status: FactStatus
  readonly sourceKind: SourceKind
  readonly trust: number
  readonly validFrom: string | null
  readonly validTo: string | null
  readonly supersedesId: string | null
  readonly conflictWith: string | null
  /** 'set' = a value; 'retire' = a proposal to stop using the active fact in `conflictWith` (its last evidence is gone). */
  readonly proposalKind: ProposalKind
  readonly evidence: ReadonlyArray<Evidence>
  readonly proposedBy: string
  readonly proposedAt: string
  readonly decidedBy: string | null
  readonly decidedAt: string | null
  readonly decisionNote: string | null
}

export type Lesson = {
  readonly id: string
  readonly module: string | null
  readonly title: string
  readonly body: string
  readonly appliesWhen: string
  readonly status: LessonStatus
  readonly origin: LessonOrigin
  readonly evidence: ReadonlyArray<Evidence>
  readonly version: number
  readonly proposedBy: string
  readonly proposedAt: string
  readonly decidedBy: string | null
  readonly decidedAt: string | null
}

/**
 * How far a source is believed, 0-100. What the owner states outranks a document, which outranks the system, staff, a customer's
 * message and, last, the model's own inference. Only owner and manager statements may become active without a review.
 */
export const TRUST: Readonly<Record<SourceKind, number>> = { owner: 95, manager: 85, document: 75, system: 70, staff: 60, customer: 30, ai: 20 }
export const AUTO_APPLY_TRUST = 85

/** Lower case, accents removed (đ -> d), anything else to single dashes: "Combo Thư giãn!" -> "combo-thu-gian". */
export const keyOf = (s: string): string =>
  s.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120)

/** A number written the Vietnamese way ("650.000đ", "1,2 tr", "8tr", "2 triệu", "1.5k") or null. */
export const numberOf = (raw: string): number | null => {
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim()
  const m = s.match(/(-?\d[\d.,]*)\s*(tỷ|ty|triệu|trieu|tr|nghìn|nghin|ngàn|ngan|k)?/)
  if (!m) return null
  const digits = m[1]
  const unit = m[2] ?? ""
  const scale = /^(tỷ|ty)$/.test(unit) ? 1e9 : /^(triệu|trieu|tr)$/.test(unit) ? 1e6 : /^(nghìn|nghin|ngàn|ngan|k)$/.test(unit) ? 1e3 : 1
  // With a scale word "1,2" / "1.5" is a decimal; without one "650.000" / "650,000" groups thousands.
  const n = scale > 1 ? Number(digits.replace(",", ".")) : Number(digits.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."))
  return Number.isFinite(n) ? Math.round(n * scale * 100) / 100 : null
}

/** Two values say the same thing: equal numbers, or equal once normalised ("650.000đ" vs "650000 d" are both 650000). */
export const sameValue = (a: string, b: string): boolean => {
  const na = numberOf(a)
  const nb = numberOf(b)
  if (na !== null && nb !== null && keyOf(a.replace(/[\d.,\s]/g, "")) === keyOf(b.replace(/[\d.,\s]/g, ""))) return na === nb
  return keyOf(a) === keyOf(b)
}

/** Whether a fact is visible to an agent with this audience and module (the "view" of the one shared brain). */
export const visibleTo = (fact: Pick<Fact, "scope" | "modules">, audience: Audience, module: string): boolean => {
  if (fact.scope === "public") return true
  if (fact.scope === "internal") return audience === "internal"
  return audience === "internal" && fact.modules.includes(module)
}

/** Whether a lesson applies to this module (its own, or a shared one). */
export const lessonFor = (lesson: Pick<Lesson, "module">, module: string): boolean => lesson.module === null || lesson.module === module

/** Whether a fact is in force now (validity window). */
export const inForce = (fact: Pick<Fact, "validFrom" | "validTo">, now = Date.now()): boolean =>
  (!fact.validFrom || Date.parse(fact.validFrom) <= now) && (!fact.validTo || Date.parse(fact.validTo) > now)

/** One line of a fact for a prompt or a list: "Combo thư giãn · Giá: 650.000đ / 90 phút". */
export const factLine = (f: Pick<Fact, "subjectLabel" | "attributeLabel" | "value">): string => `${f.subjectLabel} · ${f.attributeLabel}: ${f.value}`

/* ------------------------------------------------------------------ resolving a disagreement */

export type Resolution = "apply" | "schedule" | "reject" | "split" | "ask"
export type Suggestion = { readonly action: Resolution; readonly reason: { readonly vi: string; readonly en: string } }

/** Words that make a value conditional ("cuối tuần", "sinh viên"...): two such values may both be true, for different situations. */
const CONDITIONS = ["cuoi-tuan", "ngay-thuong", "thu-7", "thu-bay", "chu-nhat", "ngay-le", "le-tet", "tet", "buoi-toi", "buoi-sang", "vip", "sinh-vien", "khach-moi", "thanh-vien", "online", "tai-cho", "weekend", "weekday", "holiday", "member", "student"]
const conditionsOf = (value: string): Array<string> => { const k = `-${keyOf(value)}-`; return CONDITIONS.filter((c) => k.includes(`-${c}-`)) }
const STALE_DAYS = 120

/**
 * NIVO's suggestion for a proposal, with its reason in plain words. Deterministic (no model call), checked in this order:
 * a later start date schedules it; a value tied to a situation the current one is not ("cuối tuần") suggests two facts; fresh figures from a
 * connected system backed by a record (SePay reconciliation) apply; a much less
 * trusted source (a customer's message, the model's guess) suggests rejecting; a source at least as trusted, or a current value nobody has
 * confirmed for months, suggests applying; anything else: ask the person who proposed it.
 */
export const suggestResolution = (p: Fact, current: Fact | null, now = Date.now()): Suggestion => {
  const date = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/")
  if (p.validFrom && Date.parse(p.validFrom) > now) {
    const d = date(p.validFrom)
    return { action: "schedule", reason: {
      vi: `Giá trị mới có hiệu lực từ ${d}. Áp dụng theo lịch: ${current ? `"${current.value}" vẫn dùng tới hết ngày trước đó` : "tới ngày đó agent mới dùng"}.`,
      en: `The new value starts on ${d}. Schedule it: ${current ? `"${current.value}" stays in force until then` : "agents start using it on that day"}.`,
    } }
  }
  if (!current) {
    return p.trust >= TRUST.staff
      ? { action: "apply", reason: { vi: `Chưa có giá trị nào cho mục này; nguồn ${p.proposedBy} đủ tin cậy (${p.trust}).`, en: `Nothing is recorded for this yet; ${p.proposedBy} is a trusted enough source (${p.trust}).` } }
      : { action: "ask", reason: { vi: `Thông tin mới từ nguồn ít tin cậy (${p.trust}). Xác nhận lại trước khi agent dùng.`, en: `New information from a less trusted source (${p.trust}). Confirm it before agents use it.` } }
  }
  const newConditions = conditionsOf(p.value).filter((c) => !conditionsOf(current.value).includes(c))
  if (newConditions.length) {
    return { action: "split", reason: {
      vi: `"${p.value}" có vẻ chỉ đúng trong một hoàn cảnh (${newConditions.join(", ").replace(/-/g, " ")}). Có thể cả hai cùng đúng: giữ "${current.value}" và thêm một sự thật riêng cho hoàn cảnh đó.`,
      en: `"${p.value}" looks tied to one situation (${newConditions.join(", ").replace(/-/g, " ")}). Both may be true: keep "${current.value}" and add a separate fact for that situation.`,
    } }
  }
  if (p.sourceKind === "system" && p.evidence.some((e) => e.kind === "data_record")) {
    return { action: "apply", reason: {
      vi: `Số liệu mới từ hệ thống (${p.proposedBy}), có bản ghi đối soát làm bằng chứng; "${current.value}" là số cũ. Áp dụng; số cũ vào lịch sử.`,
      en: `Fresh figures from a connected system (${p.proposedBy}), backed by a reconciled record; "${current.value}" is older. Apply it; the old figure goes to history.`,
    } }
  }
  if (p.trust + 20 <= current.trust && (p.sourceKind === "customer" || p.sourceKind === "ai")) {
    return { action: "reject", reason: {
      vi: `"${current.value}" do ${current.decidedBy ?? current.proposedBy} xác nhận (tin cậy ${current.trust}); đề xuất đến từ ${p.sourceKind === "customer" ? "tin nhắn khách" : "suy luận của AI"} (tin cậy ${p.trust}), có thể nhớ nhầm. Giữ giá trị đang dùng.`,
      en: `"${current.value}" was confirmed by ${current.decidedBy ?? current.proposedBy} (trust ${current.trust}); the proposal comes from ${p.sourceKind === "customer" ? "a customer's message" : "the AI's inference"} (trust ${p.trust}) and may be mistaken. Keep the current value.`,
    } }
  }
  const confirmedAt = Date.parse(current.decidedAt ?? current.proposedAt)
  const staleDays = Math.floor((now - confirmedAt) / 86_400_000)
  if (p.trust >= current.trust || staleDays >= STALE_DAYS) {
    return { action: "apply", reason: {
      vi: p.trust >= current.trust
        ? `Nguồn mới (${p.proposedBy}, tin cậy ${p.trust}) không kém nguồn cũ (${current.trust}) và mới hơn. Áp dụng; "${current.value}" vào lịch sử.`
        : `"${current.value}" đã ${staleDays} ngày chưa ai xác nhận lại. Áp dụng giá trị mới; giá trị cũ vào lịch sử.`,
      en: p.trust >= current.trust
        ? `The new source (${p.proposedBy}, trust ${p.trust}) is as trusted as the old one (${current.trust}) and newer. Apply it; "${current.value}" goes to history.`
        : `"${current.value}" has not been confirmed for ${staleDays} days. Apply the new value; the old one goes to history.`,
    } }
  }
  return { action: "ask", reason: {
    vi: `Hai nguồn nói khác nhau và nguồn mới (${p.trust}) kém tin cậy hơn nguồn cũ (${current.trust}). Hỏi lại ${p.proposedBy} trước khi quyết.`,
    en: `The sources disagree and the new one (${p.trust}) is less trusted than the old one (${current.trust}). Ask ${p.proposedBy} before deciding.`,
  } }
}

/* ------------------------------------------------------------------ reading facts out of documents */

/** Where the reading of one document stands (brain_extractions.status). `blocked_credits`: the workspace is out of credits, nothing ran. */
export type ExtractionStatus = "queued" | "running" | "done" | "failed" | "blocked_credits"

/** What the UI needs of a document's extraction record. */
export type ExtractionInfo = {
  readonly sourceId: string
  readonly status: ExtractionStatus
  /** Facts filed from this document (new proposals, evidence added to waiting or active facts). */
  readonly factsProposed: number
  readonly error: string | null
}

/** Whether the reading will not change any more without outside help (shown as done, failed or paused). */
export const extractionSettled = (s: ExtractionStatus): boolean => s === "done" || s === "failed" || s === "blocked_credits"
