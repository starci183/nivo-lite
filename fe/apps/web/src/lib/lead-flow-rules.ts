/**
 * Lead flow rules (lead_gen): everything that can be decided without I/O. The state machine, the dedupe of a prospect, the owner's questions
 * and criteria read from their words, the pure hot / warm / cold score, the escalation triggers and the 24 hour window. lead-flow.ts runs
 * these against the database and Meta; this file is what can be checked with plain node (it imports nothing at runtime).
 *
 *   state machine (lead_flows.state)
 *
 *     new --greet--> greeted --ask--> qualifying --ask--> qualifying ...
 *     qualifying | greeted | new --hot + contact + need--> handed_off      (handoff_to_sales, Sales classify_lead)
 *     qualifying --warm, questions done--> nurturing                         (follow_up_lead)
 *     qualifying --cold, questions done--> closed                            (close_lead)
 *     scored       a lead with no chat to continue (form, mention): scored, handed over when hot, else a person follows up
 *     any --complaint | refund | angry | "is this a real person" | confidence < 0.6 | negative public comment--> escalated (the bot is silent)
 *     escalated --a person gives the conversation back--> resume_state
 */

export type FlowState =
    "new" | "greeted" | "qualifying" | "scored" | "handed_off" | "nurturing" | "closed" | "escalated"
export type Level = "hot" | "warm" | "cold"
export type SourceKind = "leadgen" | "dm" | "comment" | "mention"
export type Platform = "facebook" | "instagram"

export type Referral = {
    readonly ref: string | null
    readonly source: string | null
    readonly type: string | null
    readonly ad_id: string | null
}
/** Where a touch came from: the platform, what kind of touch, and the post / ad / form / comment it hung on. */
export type LeadSource = {
    readonly platform: Platform
    readonly kind: SourceKind
    readonly post_id: string | null
    readonly ad_id: string | null
    readonly form_id: string | null
    readonly comment_id: string | null
    readonly leadgen_id: string | null
    readonly referral: Referral | null
    readonly at: string | null
}

export type Identity = {
    readonly psid: string | null
    readonly igsid: string | null
    readonly phone: string | null
    readonly email: string | null
}

export const MAX_QUESTIONS = 4
/** The confidence below which the bot hands over to a person (the same bar as the gate, policy.ts MIN_CONFIDENCE). */
export const MIN_CONFIDENCE = 0.6
export const DAY_MS = 86_400_000
export const WINDOW_MS = DAY_MS
export const HUMAN_AGENT_MS = 7 * DAY_MS

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
const orNull = (v: unknown): string | null => text(v) || null

/* ------------------------------------------------------------------ text helpers */

/** Lower case, no accents: "Hoàn tiền" -> "hoan tien". */
export const fold = (s: string): string =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim()

/** VN phone -> 84... digits; email -> lower case; anything else null. Same rule as core.normaliseContact. */
export const normPhone = (raw: unknown): string | null => {
    const v = text(raw)
    if (!v || v.includes("@")) return null
    let d = v.replace(/\D/g, "")
    if (d.length < 8) return null
    if (d.startsWith("0")) d = `84${d.slice(1)}`
    else if (!d.startsWith("84") && d.length === 9) d = `84${d}`
    return d
}
export const normEmail = (raw: unknown): string | null => {
    const v = text(raw).toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null
}

/** The first phone number or email written in a free text, normalised. */
export const contactIn = (s: string): { phone: string | null; email: string | null } => {
    const email = s.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/)?.[0] ?? null
    const phoneRaw = s.replace(email ?? "", " ").match(/(?:\+?84|0)[\s.\-]?\d(?:[\s.\-]?\d){7,9}/)?.[0] ?? null
    return { phone: normPhone(phoneRaw), email: normEmail(email) }
}

/* ------------------------------------------------------------------ dedupe: one prospect, however they came in */

export type FlowIdentityRow = Identity & {
    readonly id: string
    readonly lead_id: string | null
    readonly connection_id: string | null
}

/**
 * The existing flow of this person, by the strongest key first: Messenger id, Instagram id, phone, email. A Messenger / Instagram id is only
 * meaningful on the connection (Page) that issued it. `by` says which key matched.
 */
export const matchFlow = <R extends FlowIdentityRow>(
    rows: ReadonlyArray<R>,
    id: Identity,
    connectionId: string | null,
): { readonly row: R; readonly by: "psid" | "igsid" | "phone" | "email" } | null => {
    const sameConn = (r: R) => r.connection_id === null || connectionId === null || r.connection_id === connectionId
    const tries: Array<["psid" | "igsid" | "phone" | "email", (r: R) => boolean]> = [
        ["psid", (r) => !!id.psid && r.psid === id.psid && sameConn(r)],
        ["igsid", (r) => !!id.igsid && r.igsid === id.igsid && sameConn(r)],
        ["phone", (r) => !!id.phone && r.phone === id.phone],
        ["email", (r) => !!id.email && r.email === id.email],
    ]
    for (const [by, ok] of tries) {
        const row = rows.find(ok)
        if (row) return { row, by }
    }
    return null
}

/** Only the identity keys the row does not have yet (an existing key is never overwritten by a different one). */
export const identityPatch = (row: Identity, incoming: Identity): Partial<Identity> => {
    const out: { -readonly [K in keyof Identity]?: string | null } = {}
    for (const k of ["psid", "igsid", "phone", "email"] as const) if (incoming[k] && !row[k]) out[k] = incoming[k]
    return out
}

const touchKey = (s: LeadSource): string =>
    `${s.kind}:${s.comment_id ?? s.leadgen_id ?? s.form_id ?? s.ad_id ?? s.post_id ?? s.referral?.ref ?? "-"}`

/** Add a touch once (same kind and same comment / lead / form / ad / post is one touch). */
export const addTouch = (touches: ReadonlyArray<LeadSource>, s: LeadSource): Array<LeadSource> =>
    touches.some((t) => touchKey(t) === touchKey(s)) ? [...touches] : [...touches, s].slice(-30)

export const sourceLine = (s: Partial<LeadSource>): string =>
    [
        s.platform === "instagram" ? "Instagram" : "Facebook",
        ({ leadgen: "Lead Ads", dm: "tin nhắn", comment: "bình luận", mention: "nhắc tên" } as Record<string, string>)[
            s.kind ?? ""
        ] ?? s.kind,
        s.form_id ? `form ${s.form_id}` : null,
        s.ad_id ? `quảng cáo ${s.ad_id}` : null,
        s.post_id ? `bài ${s.post_id}` : null,
        s.referral?.ref ? `ref ${s.referral.ref}` : null,
    ]
        .filter(Boolean)
        .join(" · ")

/* ------------------------------------------------------------------ the owner's questions and criteria (from their words) */

/**
 * The qualification questions the owner wrote (a Second Brain fact, one or many lines): at most 4, in order. Accepts a numbered or
 * bulleted list, one per line, or a single paragraph of questions ending in "?".
 */
export const parseQuestions = (raw: string, max = MAX_QUESTIONS): Array<string> => {
    const clean = (s: string) =>
        s
            .replace(/^\s*(?:[-*•]+|\d{1,2}[.):])\s*/, "")
            .replace(/\s+/g, " ")
            .trim()
    let parts = raw
        .split(/\r?\n+/)
        .map(clean)
        .filter(Boolean)
    if (parts.length <= 1) {
        const one = parts[0] ?? ""
        const qs = one.match(/[^?]+\?/g)
        parts = qs && qs.length > 1 ? qs.map(clean).filter(Boolean) : one ? [one] : []
    }
    // A line of two questions ("Dịch vụ nào? Ngân sách?") stays two questions, never more than the cap.
    const out: Array<string> = []
    for (const p of parts) {
        const qs = p.match(/[^?]+\?/g)
        if (qs && qs.length > 1) out.push(...qs.map(clean).filter(Boolean))
        else out.push(p)
    }
    return [...new Set(out)].slice(0, max)
}

/** What a lead can show. The owner's criteria are read as sets of these. */
export type Requirement =
    | "contact"
    | "need"
    | "budget_fit"
    | "timeline_soon"
    | "area_fit"
    | "asks_price_or_schedule"
    | "wants_meeting"
    | "interest_high"
export const REQUIREMENTS: ReadonlyArray<Requirement> = [
    "contact",
    "need",
    "budget_fit",
    "timeline_soon",
    "area_fit",
    "asks_price_or_schedule",
    "wants_meeting",
    "interest_high",
]

export type Criteria = {
    /** hot: every `all` requirement, and at least one of `any` (when `any` is not empty) */
    readonly hot: { readonly all: ReadonlyArray<Requirement>; readonly any: ReadonlyArray<Requirement> }
    /** warm: every `all` requirement, or interested enough (see scoreLead) */
    readonly warm: { readonly all: ReadonlyArray<Requirement> }
    /** the owner serves an area: a lead clearly outside it is cold */
    readonly areaMatters: boolean
}

/** The owner said nothing usable: contact and need, and one more sign of intent, is hot. */
export const DEFAULT_CRITERIA: Criteria = {
    hot: { all: ["contact", "need"], any: ["asks_price_or_schedule", "timeline_soon", "budget_fit", "wants_meeting"] },
    warm: { all: ["need"] },
    areaMatters: false,
}

const SIGNAL_WORDS: ReadonlyArray<readonly [Requirement, RegExp]> = [
    ["contact", /\b(so dien thoai|sdt|dien thoai|phone|email|lien he|zalo|so cua|de lai so|contact|number)\b/],
    [
        "asks_price_or_schedule",
        /\b(gia|bao gia|bang gia|price|pricing|quote|lich|dat lich|hen|schedule|booking|book|appointment)\b/,
    ],
    ["budget_fit", /\b(ngan sach|budget|tai chinh|chi phi|trong khoang)\b/],
    [
        "timeline_soon",
        /\b(gap|ngay|som|tuan nay|thang nay|urgent|soon|asap|this week|this month|trong tuan|truoc ngay)\b/,
    ],
    ["area_fit", /\b(khu vuc|o tp|tai tp|quan|huyen|thanh pho|area|city|district|gan)\b/],
    ["wants_meeting", /\b(gap nguoi|noi chuyen voi|goi lai|call back|goi cho|tu van truc tiep|speak to|meet)\b/],
    ["need", /\b(nhu cau|quan tam|can|muon|need|interested|looking for)\b/],
]

const LEVEL_WORDS = {
    hot: /\b(nong|hot)\b/,
    warm: /\b(am|warm)\b/,
    cold: /\b(lanh|cold)\b/,
} as const

/**
 * Read the owner's "hot / warm / cold" criteria (free text, one fact) into requirements. It looks for the three level words and, in the
 * text after each, the signals it names ("Nóng = để lại số và hỏi giá hoặc lịch": contact + price or schedule). Anything it cannot read
 * falls back to DEFAULT_CRITERIA, so a vague text never makes every lead hot.
 */
export const parseCriteria = (raw: string, areaText = ""): Criteria => {
    const f = fold(raw)
    const at = (re: RegExp): number => {
        const m = re.exec(f)
        return m ? m.index : -1
    }
    const marks = (["hot", "warm", "cold"] as const)
        .map((l) => ({ l, i: at(LEVEL_WORDS[l]) }))
        .filter((x) => x.i >= 0)
        .sort((a, b) => a.i - b.i)
    const segment = (l: "hot" | "warm" | "cold"): string => {
        const idx = marks.findIndex((m) => m.l === l)
        if (idx < 0) return ""
        return f.slice(marks[idx].i, marks[idx + 1]?.i ?? f.length)
    }
    const signalsOf = (seg: string): Array<Requirement> => SIGNAL_WORDS.filter(([, re]) => re.test(seg)).map(([r]) => r)
    const hotSeg = segment("hot")
    const hotSignals = signalsOf(hotSeg)
    const areaMatters = fold(areaText).length > 8 || /\b(khu vuc|area)\b/.test(f)
    if (!hotSignals.length) return { ...DEFAULT_CRITERIA, areaMatters }

    // "hoặc" / "or" inside the hot segment makes the signals after it alternatives; the rest are required.
    const orAt = hotSeg.search(/\b(hoac|or)\b/)
    const before = orAt >= 0 ? signalsOf(hotSeg.slice(0, orAt)) : hotSignals
    const after = orAt >= 0 ? signalsOf(hotSeg.slice(orAt)).filter((s) => !before.includes(s)) : []
    const requiredAll = before.filter((r) => r !== "asks_price_or_schedule" || after.length === 0)
    // Price or schedule asked together with a contact is the usual meaning of "leaves a number and asks for the price".
    const anyOf = [...before.filter((r) => !requiredAll.includes(r)), ...after]
    const all = requiredAll.length ? requiredAll : ["need" as Requirement]
    const warmSignals = signalsOf(segment("warm")).filter((r) => r === "need" || r === "contact")
    return {
        hot: { all: [...new Set<Requirement>(["need", ...all])], any: anyOf },
        warm: { all: warmSignals.length ? warmSignals : ["need"] },
        areaMatters,
    }
}

/** Which setup answer a Second Brain fact is, from its attribute key (brain/shared keyOf of the label): the questions, the hot / warm / cold criteria, the ideal customer and area. */
export const setupKindOf = (attribute: string): "questions" | "criteria" | "icp" | null => {
    const a = attribute.toLowerCase()
    if (/cau-hoi-sang-loc|qualification-question|qualifying-question/.test(a)) return "questions"
    if (/nong-am-lanh|hot-warm-cold|tieu-chi-khach/.test(a)) return "criteria"
    if (/khach-hang-ly-tuong|ideal-customer/.test(a)) return "icp"
    return null
}

/* ------------------------------------------------------------------ signals and the pure score */

export type Signals = {
    /** what they want, in their words (short) */
    readonly need: string | null
    /** a phone number or email they shared */
    readonly contact: string | null
    readonly budget: "fit" | "low" | "unknown"
    readonly timeline: "soon" | "later" | "unknown"
    readonly area: "fit" | "outside" | "unknown"
    readonly asks_price_or_schedule: boolean
    readonly wants_meeting: boolean
    readonly interest: "high" | "medium" | "low" | "none"
}

export const EMPTY_SIGNALS: Signals = {
    need: null,
    contact: null,
    budget: "unknown",
    timeline: "unknown",
    area: "unknown",
    asks_price_or_schedule: false,
    wants_meeting: false,
    interest: "medium",
}

const pickOf = <T extends string>(v: unknown, allowed: ReadonlyArray<T>, fallback: T): T =>
    typeof v === "string" && (allowed as ReadonlyArray<string>).includes(v) ? (v as T) : fallback

export const cleanSignals = (raw: unknown): Signals => {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const c = contactIn(text(o.contact))
    return {
        need: orNull(o.need)?.slice(0, 200) ?? null,
        contact: c.phone ?? c.email ?? null,
        budget: pickOf(o.budget, ["fit", "low", "unknown"], "unknown"),
        timeline: pickOf(o.timeline, ["soon", "later", "unknown"], "unknown"),
        area: pickOf(o.area, ["fit", "outside", "unknown"], "unknown"),
        asks_price_or_schedule: o.asks_price_or_schedule === true,
        wants_meeting: o.wants_meeting === true,
        interest: pickOf(o.interest, ["high", "medium", "low", "none"], "medium"),
    }
}

/** Later signals refine earlier ones: a value that was found stays unless the new text says otherwise. */
export const mergeSignals = (old: Partial<Signals> | null | undefined, next: Signals): Signals => {
    const o = { ...EMPTY_SIGNALS, ...(old ?? {}) }
    return {
        need: next.need ?? o.need,
        contact: next.contact ?? o.contact,
        budget: next.budget !== "unknown" ? next.budget : o.budget,
        timeline: next.timeline !== "unknown" ? next.timeline : o.timeline,
        area: next.area !== "unknown" ? next.area : o.area,
        asks_price_or_schedule: next.asks_price_or_schedule || o.asks_price_or_schedule,
        wants_meeting: next.wants_meeting || o.wants_meeting,
        interest: next.interest !== "medium" ? next.interest : o.interest,
    }
}

const has = (s: Signals, r: Requirement): boolean => {
    switch (r) {
        case "contact":
            return !!s.contact
        case "need":
            return !!s.need
        case "budget_fit":
            return s.budget === "fit"
        case "timeline_soon":
            return s.timeline === "soon"
        case "area_fit":
            return s.area === "fit"
        case "asks_price_or_schedule":
            return s.asks_price_or_schedule
        case "wants_meeting":
            return s.wants_meeting
        case "interest_high":
            return s.interest === "high"
    }
}

export type Score = {
    readonly level: Level
    readonly reasons: ReadonlyArray<string>
    readonly missing: ReadonlyArray<Requirement>
}

/**
 * hot / warm / cold. Pure: the same signals and criteria always give the same answer.
 *   cold  clearly not interested, or clearly outside the owner's area (when the owner serves an area)
 *   hot   every required signal of the hot criteria, and one of the alternatives when the owner listed any
 *   warm  the warm criteria hold (a stated need by default), or the person is plainly interested
 *   cold  otherwise
 * `missing` is what a hot score still lacks, so the bot knows what to ask next.
 */
export const scoreLead = (signals: Signals, criteria: Criteria = DEFAULT_CRITERIA): Score => {
    const reasons: Array<string> = []
    if (signals.interest === "none") return { level: "cold", reasons: ["not interested"], missing: [] }
    if (criteria.areaMatters && signals.area === "outside")
        return { level: "cold", reasons: ["outside the service area"], missing: [] }
    const missingAll = criteria.hot.all.filter((r) => !has(signals, r))
    const anyOk = criteria.hot.any.length === 0 || criteria.hot.any.some((r) => has(signals, r))
    if (missingAll.length === 0 && anyOk) {
        reasons.push(...criteria.hot.all.map((r) => r), ...criteria.hot.any.filter((r) => has(signals, r)))
        return { level: "hot", reasons, missing: [] }
    }
    const missing: Array<Requirement> = [...missingAll, ...(anyOk ? [] : criteria.hot.any.slice(0, 1))]
    const warmOk = criteria.warm.all.every((r) => has(signals, r)) || signals.interest === "high"
    if (warmOk && signals.interest !== "low")
        return { level: "warm", reasons: [`missing for hot: ${missing.join(", ") || "-"}`], missing }
    return { level: "cold", reasons: [signals.interest === "low" ? "low interest" : "no clear need yet"], missing }
}

/** A hot lead can be handed to Sales only with a way to reach them and a need (the gate's required fields, module.json). */
export const handoffReady = (
    signals: Signals,
    flow: {
        readonly psid?: string | null
        readonly igsid?: string | null
        readonly phone?: string | null
        readonly email?: string | null
    },
): { ok: boolean; contact: string | null; need: string | null } => {
    const contact = signals.contact ?? flow.phone ?? flow.email ?? flow.psid ?? flow.igsid ?? null
    const need = signals.need
    return { ok: !!contact && !!need, contact, need }
}

/* ------------------------------------------------------------------ escalation: when a person must take over */

export type EscalationReason =
    "complaint" | "refund" | "angry" | "real_person" | "low_confidence" | "negative_comment" | "unreadable"

const ESCALATION_PATTERNS: ReadonlyArray<readonly [EscalationReason, RegExp]> = [
    ["refund", /\b(hoan tien|tra lai tien|refund|money back|doi tra|boi thuong|compensation|chargeback)\b/],
    [
        "complaint",
        /\b(khieu nai|phan nan|to cao|lua dao|lua dao|complain|complaint|scam|bao chi|kien|co quan chuc nang|bao cong an|rac|te qua)\b/,
    ],
    [
        "angry",
        /\b(buc minh|buc xuc|tuc gian|qua doi|vo trach nhiem|dm|dcm|vcl|do ngu|ngu qua|cut|angry|furious|worst|terrible|unacceptable|ridiculous)\b/,
    ],
    [
        "real_person",
        /(\b(co phai|la)\s+(nguoi that|nguoi hay may|bot|robot|ai|may)\b|\b(nguoi that|nguoi that khong|nguoi that ko|ban la bot|ban la ai|are you (a )?(real|human|bot|robot|person)|real person|talk to (a )?(human|person|someone)|noi chuyen voi nguoi|gap nguoi that|nhan vien that|cho gap nhan vien)\b)/,
    ],
]

/** Keyword triggers, free of any model call. The first match wins (refund, complaint, angry, real person). */
export const escalationFromText = (s: string): EscalationReason | null => {
    const f = fold(s)
    if (!f) return null
    for (const [reason, re] of ESCALATION_PATTERNS) if (re.test(f)) return reason
    return null
}

export type Sentiment = "positive" | "neutral" | "negative"
export type Flags = {
    readonly complaint: boolean
    readonly refund: boolean
    readonly angry: boolean
    readonly asks_real_person: boolean
}

/** The reason to hand over, from the words and the model's reading. null = the bot may continue. A comment's negative sentiment is handled apart (negativeComment). */
export const escalationOf = (a: {
    readonly text: string
    readonly flags?: Partial<Flags> | null
    readonly confidence?: number | null
    readonly aiFailed?: boolean
}): EscalationReason | null => {
    const byText = escalationFromText(a.text)
    if (byText) return byText
    const f = a.flags ?? {}
    if (f.refund) return "refund"
    if (f.complaint) return "complaint"
    if (f.angry) return "angry"
    if (f.asks_real_person) return "real_person"
    if (a.aiFailed) return "unreadable"
    if (typeof a.confidence === "number" && a.confidence < MIN_CONFIDENCE) return "low_confidence"
    return null
}

/* ------------------------------------------------------------------ the model's reading of one turn */

export type Analysis = {
    /** idempotency: the turn this belongs to (one metered call per turn) */
    readonly turn: string
    readonly signals: Signals
    readonly sentiment: Sentiment
    readonly flags: Flags
    readonly confidence: number
    /** the short brand-voice reply to what the person wrote, from public knowledge only ("" = nothing to add) */
    readonly reply: string
    /** the person's answer to the question that was pending, cleaned */
    readonly answer: string | null
    readonly knowledge_gap: { readonly question: string; readonly topic: string } | null
    /** comments: the short public reply and the private message */
    readonly public_reply: string
    readonly private_reply: string
}

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

/** Validate and clamp what the model returned. A missing or broken field is the safe value, never a guess. */
export const parseAnalysis = (raw: unknown, turn: string): Analysis => {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const flagsIn = (o.flags && typeof o.flags === "object" ? o.flags : {}) as Record<string, unknown>
    const gapIn = (o.knowledge_gap && typeof o.knowledge_gap === "object" ? o.knowledge_gap : null) as Record<
        string,
        unknown
    > | null
    const confidence =
        typeof o.confidence === "number" && Number.isFinite(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : 0.5
    const question = text(gapIn?.question)
    return {
        turn,
        signals: cleanSignals(o.signals),
        sentiment: pickOf(o.sentiment, ["positive", "neutral", "negative"], "neutral"),
        flags: {
            complaint: flagsIn.complaint === true,
            refund: flagsIn.refund === true,
            angry: flagsIn.angry === true,
            asks_real_person: flagsIn.asks_real_person === true,
        },
        confidence,
        reply: clip(text(o.reply), 700),
        answer: orNull(o.answer) ? clip(text(o.answer), 300) : null,
        knowledge_gap: question ? { question: clip(question, 300), topic: clip(text(gapIn?.topic), 120) } : null,
        public_reply: clip(text(o.public_reply), 300),
        private_reply: clip(text(o.private_reply), 700),
    }
}

/**
 * A direct question the knowledge could not answer is a reason for a person (the model is told to say so with a gap), so the confidence
 * cannot stay above the bar: a gap caps it just under MIN_CONFIDENCE.
 */
export const effectiveConfidence = (a: Pick<Analysis, "confidence" | "knowledge_gap">): number =>
    a.knowledge_gap ? Math.min(a.confidence, MIN_CONFIDENCE - 0.05) : a.confidence

/* ------------------------------------------------------------------ the messaging window (Meta: 24 hours, HUMAN_AGENT up to 7 days) */

export type WindowStatus = { readonly status: "open" | "tag_only" | "closed"; readonly msLeft: number }

/** open: a normal message may go; tag_only: only a person's HUMAN_AGENT message (ask mode); closed: nothing may go. */
export const windowStatus = (lastUserAt: number | null, now: number): WindowStatus => {
    if (lastUserAt === null) return { status: "closed", msLeft: 0 }
    const age = now - lastUserAt
    if (age <= WINDOW_MS) return { status: "open", msLeft: WINDOW_MS - age }
    if (age <= HUMAN_AGENT_MS) return { status: "tag_only", msLeft: HUMAN_AGENT_MS - age }
    return { status: "closed", msLeft: 0 }
}

/* ------------------------------------------------------------------ the answers */

export type Answer = { readonly i: number; readonly question: string; readonly answer: string; readonly at: string }

/** Store the answer to the pending question (replacing an earlier answer to the same question). */
export const recordAnswer = (
    answers: ReadonlyArray<Answer>,
    i: number,
    question: string,
    answer: string,
    at: string,
): Array<Answer> =>
    [...answers.filter((a) => a.i !== i), { i, question, answer: clip(answer.trim(), 500), at }].sort(
        (a, b) => a.i - b.i,
    )

/* ------------------------------------------------------------------ the next step */

export type Step =
    | { readonly step: "escalate"; readonly reason: EscalationReason }
    | { readonly step: "greet" }
    | { readonly step: "ask"; readonly index: number }
    | { readonly step: "ask_contact" }
    | { readonly step: "handoff" }
    | { readonly step: "follow_up" }
    | { readonly step: "close" }
    | { readonly step: "hold"; readonly why: "waiting" | "done" }

export type StepInput = {
    readonly state: FlowState
    readonly kind: SourceKind
    readonly questions: ReadonlyArray<string>
    /** how many questions were asked already */
    readonly asked: number
    readonly score: Score
    readonly handoffOk: boolean
    readonly escalation: EscalationReason | null
    /** a normal message may go to this person now (inside the 24 hour window) */
    readonly canMessage: boolean
    readonly contactKnown: boolean
    /** the phone / email was already asked for once */
    readonly contactAsked: boolean
    readonly greeted: boolean
}

/**
 * The state machine's decision after a turn has been read and scored. Order matters:
 *   1. a person is needed -> escalate (nothing else is sent)
 *   2. hot with contact and need -> hand over to Sales (no more questions)
 *   3. cold because the person is not interested -> close
 *   4. inside the window: greet first; then the next question (at most 4 in all, one per turn); contact missing -> ask for it as the last of the four
 *   5. questions done: warm -> follow up, cold -> close, hot without contact or need -> follow up (never handed over incomplete)
 *   6. no window (form, mention, window over) -> hot goes to Sales, warm goes to a person for a follow-up, cold closes; nothing is sent
 */
export const nextStep = (i: StepInput): Step => {
    if (i.escalation) return { step: "escalate", reason: i.escalation }
    if (i.state === "escalated") return { step: "hold", why: "waiting" }
    if (i.state === "handed_off") return { step: "hold", why: "done" }
    if (i.score.level === "hot" && i.handoffOk) return { step: "handoff" }
    // No normal message may go (form lead, mention, window over): warm and incomplete hot leads go to a person (Sales follow-up), cold ones close silently.
    if (!i.canMessage) return i.score.level === "cold" ? { step: "close" } : { step: "follow_up" }
    if (i.score.level === "cold" && i.score.reasons.includes("not interested")) return { step: "close" }
    if (!i.greeted && i.kind === "dm" && i.state === "new") return { step: "greet" }
    const cap = Math.min(MAX_QUESTIONS, i.questions.length)
    if (i.asked < cap) return { step: "ask", index: i.asked }
    if (!i.contactKnown && !i.contactAsked && i.asked < MAX_QUESTIONS && i.score.level !== "cold")
        return { step: "ask_contact" }
    if (i.score.level === "cold") return { step: "close" }
    return { step: "follow_up" }
}

/** The state a step leaves the flow in. */
export const stateAfter = (step: Step["step"], current: FlowState): FlowState => {
    switch (step) {
        case "greet":
            return "greeted"
        case "ask":
        case "ask_contact":
            return "qualifying"
        case "handoff":
            return "handed_off"
        case "follow_up":
            return "nurturing"
        case "close":
            return "closed"
        case "escalate":
            return "escalated"
        case "hold":
            return current === "new" ? "scored" : current
    }
}

/* ------------------------------------------------------------------ fixed lines (no model call), Vietnamese first */

export type Locale = "vi" | "en"
const L = (locale: Locale, vi: string, en: string): string => (locale === "en" ? en : vi)

export const lines = {
    greet: (l: Locale, name: string | null) =>
        L(
            l,
            `Dạ chào${name ? ` ${name}` : " anh/chị"}, cảm ơn anh/chị đã nhắn cho mình. Mình có thể hỗ trợ gì cho anh/chị ạ?`,
            `Hello${name ? ` ${name}` : ""}, thanks for getting in touch. How can we help?`,
        ),
    thanks: (l: Locale) => L(l, "Dạ, cảm ơn anh/chị.", "Thank you."),
    askContact: (l: Locale) =>
        L(
            l,
            "Anh/chị cho mình xin số điện thoại hoặc email để bên mình liên hệ lại tiện nhất nhé?",
            "Could you share a phone number or email so we can reach you?",
        ),
    followUp: (l: Locale) =>
        L(
            l,
            "Dạ cảm ơn anh/chị đã chia sẻ. Mình đã ghi nhận nhu cầu của anh/chị. Khi có thông tin hoặc ưu đãi phù hợp mình sẽ báo lại, còn cần gì anh/chị cứ nhắn cho mình nhé.",
            "Thank you for sharing. We have noted what you need and will get back to you when we have something suitable. Message us any time.",
        ),
    close: (l: Locale) =>
        L(
            l,
            "Dạ cảm ơn anh/chị đã quan tâm. Hiện tại có thể bên mình chưa phù hợp với nhu cầu của anh/chị; khi nào cần anh/chị cứ nhắn mình nhé. Chúc anh/chị một ngày tốt lành.",
            "Thank you for your interest. We may not be the right fit right now; message us whenever you need. Have a good day.",
        ),
    handover: (l: Locale) =>
        L(
            l,
            "Mình xin chuyển anh/chị cho người phụ trách để hỗ trợ kỹ hơn nhé. Mình là trợ lý tự động, bạn ấy sẽ nhắn lại sớm.",
            "I am passing you to a colleague who can help properly. I am an automated assistant; a person will reply soon.",
        ),
    publicReply: (l: Locale) =>
        L(
            l,
            "Cảm ơn bạn đã quan tâm! Mình đã nhắn tin riêng cho bạn nhé.",
            "Thanks for your interest! We have sent you a private message.",
        ),
    privateGreet: (l: Locale, name: string | null) =>
        L(
            l,
            `Chào${name ? ` ${name}` : " anh/chị"}, cảm ơn bạn đã để lại bình luận. Mình nhắn riêng để hỗ trợ bạn nhanh hơn. Bạn cần mình tư vấn điều gì ạ?`,
            `Hi${name ? ` ${name}` : ""}, thanks for your comment. We are writing privately to help you faster. What would you like to know?`,
        ),
}

/** The text of a question turn: a short acknowledgement or answer first (when there is one), then the owner's question verbatim. */
export const composeAsk = (parts: {
    readonly reply: string
    readonly question: string
    readonly locale: Locale
}): string => [parts.reply.trim() || lines.thanks(parts.locale), parts.question.trim()].filter(Boolean).join("\n\n")

/** The package Sales receives with a hot lead (module doc: name, contact, need, score and why, answers, source, last message time). */
export const handoffNeed = (a: {
    readonly need: string | null
    readonly score: Score
    readonly answers: ReadonlyArray<Answer>
    readonly source: Partial<LeadSource>
    readonly lastUserAt: string | null
}): string => {
    const parts = [
        a.need ?? "",
        a.answers.length ? `Trả lời: ${a.answers.map((x) => `${x.question} → ${x.answer}`).join(" | ")}` : "",
        `Điểm: ${a.score.level} (${a.score.reasons.join(", ")})`,
        `Nguồn: ${sourceLine(a.source)}`,
        a.lastUserAt ? `Tin cuối của khách: ${a.lastUserAt} (khung 24 giờ tính từ đó)` : "",
    ].filter(Boolean)
    return parts.join("\n").slice(0, 900)
}
