import { contactIn, fold, textOf, textOrNull } from "./lead-flow-identity.policy"
import type { Criteria, HandoffReadiness, Identity, Requirement, Score, Signals } from "./lead-flows.contracts"

/** At most four qualification questions. */
export const MAX_QUESTIONS = 4

/** The owner said nothing usable: contact and need, and one more sign of intent, is hot. */
export const DEFAULT_CRITERIA: Criteria = {
    hot: { all: ["contact", "need"], any: ["asks_price_or_schedule", "timeline_soon", "budget_fit", "wants_meeting"] },
    warm: { all: ["need"] },
    areaMatters: false,
}

/** Nothing read yet. */
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

/** Which setup answer a fact is: the questions, the hot / warm / cold criteria, or the ideal customer and area. */
export type SetupKind = "questions" | "criteria" | "icp"

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

const LEVEL_WORDS: ReadonlyArray<readonly ["hot" | "warm" | "cold", RegExp]> = [
    ["hot", /\b(nong|hot)\b/],
    ["warm", /\b(am|warm)\b/],
    ["cold", /\b(lanh|cold)\b/],
]

const cleanQuestion = (line: string): string =>
    line
        .replace(/^\s*(?:[-*•]+|\d{1,2}[.):])\s*/, "")
        .replace(/\s+/g, " ")
        .trim()

const questionsIn = (line: string): Array<string> => {
    const parts = line.split("?")
    parts.pop()
    return parts.filter((part) => part !== "").map((part) => `${part}?`)
}

/**
 * The qualification questions the owner wrote (one fact, one or many lines): at most four, in order. Accepts a numbered or bulleted list,
 * one per line, or one paragraph of questions ending in "?".
 */
export const parseQuestions = (raw: string, max = MAX_QUESTIONS): Array<string> => {
    let parts = raw
        .split(/\r?\n+/)
        .map(cleanQuestion)
        .filter((part) => part !== "")
    if (parts.length <= 1) {
        const one = parts[0] ?? ""
        const many = questionsIn(one)
        if (many.length > 1) parts = many.map(cleanQuestion).filter((part) => part !== "")
        else parts = one === "" ? [] : [one]
    }
    const out = parts.flatMap((part) => {
        const many = questionsIn(part)
        return many.length > 1 ? many.map(cleanQuestion).filter((question) => question !== "") : [part]
    })
    return [...new Set(out)].slice(0, max)
}

const signalsOf = (segment: string): Array<Requirement> =>
    SIGNAL_WORDS.filter(([, words]) => words.test(segment)).map(([requirement]) => requirement)

/**
 * The owner's hot / warm / cold criteria (free text) read into requirements: the level words and, after each, the signals it names
 * ("hot = leaves a number and asks for a price or a slot": contact + price or schedule). What it cannot read falls back to the default,
 * so a vague text never makes every lead hot.
 */
export const parseCriteria = (raw: string, areaText = ""): Criteria => {
    const folded = fold(raw)
    const marks = LEVEL_WORDS.map(([level, words]) => ({ level, at: words.exec(folded)?.index ?? -1 }))
        .filter((mark) => mark.at >= 0)
        .sort((a, b) => a.at - b.at)
    const segment = (level: "hot" | "warm" | "cold"): string => {
        const index = marks.findIndex((mark) => mark.level === level)
        const mark = marks[index]
        return mark === undefined ? "" : folded.slice(mark.at, marks[index + 1]?.at ?? folded.length)
    }
    const hotSegment = segment("hot")
    const hotSignals = signalsOf(hotSegment)
    const areaMatters = fold(areaText).length > 8 || /\b(khu vuc|area)\b/.test(folded)
    if (hotSignals.length === 0) return { ...DEFAULT_CRITERIA, areaMatters }
    const orAt = hotSegment.search(/\b(hoac|or)\b/)
    const before = orAt >= 0 ? signalsOf(hotSegment.slice(0, orAt)) : hotSignals
    const after = orAt >= 0 ? signalsOf(hotSegment.slice(orAt)).filter((signal) => !before.includes(signal)) : []
    const requiredAll = before.filter((signal) => signal !== "asks_price_or_schedule" || after.length === 0)
    const anyOf = [...before.filter((signal) => !requiredAll.includes(signal)), ...after]
    const all: ReadonlyArray<Requirement> = requiredAll.length > 0 ? requiredAll : ["need"]
    const warmSignals = signalsOf(segment("warm")).filter((signal) => signal === "need" || signal === "contact")
    return {
        hot: { all: [...new Set<Requirement>(["need", ...all])], any: anyOf },
        warm: { all: warmSignals.length > 0 ? warmSignals : ["need"] },
        areaMatters,
    }
}

/** Which setup answer a fact is, from its attribute key. */
export const setupKindOf = (attribute: string): SetupKind | null => {
    const key = attribute.toLowerCase()
    if (/cau-hoi-sang-loc|qualification-question|qualifying-question/.test(key)) return "questions"
    if (/nong-am-lanh|hot-warm-cold|tieu-chi-khach/.test(key)) return "criteria"
    if (/khach-hang-ly-tuong|ideal-customer/.test(key)) return "icp"
    return null
}

const oneOf = <T extends string>(value: unknown, allowed: ReadonlyArray<T>, fallback: T): T =>
    allowed.find((candidate) => candidate === value) ?? fallback

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The fields of an object, or none. */
export const recordOf = (value: unknown): Readonly<Record<string, unknown>> => (isRecord(value) ? value : {})

/** Signals from any shape: a missing or broken field is the safe value. */
export const cleanSignals = (raw: unknown): Signals => {
    const source = recordOf(raw)
    const found = contactIn(textOf(source.contact))
    return {
        need: textOrNull(source.need)?.slice(0, 200) ?? null,
        contact: found.phone ?? found.email ?? null,
        budget: oneOf(source.budget, ["fit", "low", "unknown"], "unknown"),
        timeline: oneOf(source.timeline, ["soon", "later", "unknown"], "unknown"),
        area: oneOf(source.area, ["fit", "outside", "unknown"], "unknown"),
        asks_price_or_schedule: source.asks_price_or_schedule === true,
        wants_meeting: source.wants_meeting === true,
        interest: oneOf(source.interest, ["high", "medium", "low", "none"], "medium"),
    }
}

/** Later signals refine earlier ones: a value found stays unless the new text says otherwise. */
export const mergeSignals = (old: Signals, next: Signals): Signals => ({
    need: next.need ?? old.need,
    contact: next.contact ?? old.contact,
    budget: next.budget === "unknown" ? old.budget : next.budget,
    timeline: next.timeline === "unknown" ? old.timeline : next.timeline,
    area: next.area === "unknown" ? old.area : next.area,
    asks_price_or_schedule: next.asks_price_or_schedule || old.asks_price_or_schedule,
    wants_meeting: next.wants_meeting || old.wants_meeting,
    interest: next.interest === "medium" ? old.interest : next.interest,
})

const HAS: Readonly<Record<Requirement, (signals: Signals) => boolean>> = {
    contact: (signals) => signals.contact !== null && signals.contact !== "",
    need: (signals) => signals.need !== null && signals.need !== "",
    budget_fit: (signals) => signals.budget === "fit",
    timeline_soon: (signals) => signals.timeline === "soon",
    area_fit: (signals) => signals.area === "fit",
    asks_price_or_schedule: (signals) => signals.asks_price_or_schedule,
    wants_meeting: (signals) => signals.wants_meeting,
    interest_high: (signals) => signals.interest === "high",
}

/**
 * hot / warm / cold, pure: the same signals and criteria always give the same answer. Cold when plainly not interested or outside the
 * served area; hot with every required signal and one alternative; warm when the warm criteria hold or the person is plainly interested.
 * `missing` is what a hot score still lacks.
 */
export const scoreLead = (signals: Signals, criteria: Criteria = DEFAULT_CRITERIA): Score => {
    if (signals.interest === "none") return { level: "cold", reasons: ["not interested"], missing: [] }
    if (criteria.areaMatters && signals.area === "outside")
        return { level: "cold", reasons: ["outside the service area"], missing: [] }
    const missingAll = criteria.hot.all.filter((requirement) => !HAS[requirement](signals))
    const anyOk = criteria.hot.any.length === 0 || criteria.hot.any.some((requirement) => HAS[requirement](signals))
    if (missingAll.length === 0 && anyOk) {
        const reasons = [...criteria.hot.all, ...criteria.hot.any.filter((requirement) => HAS[requirement](signals))]
        return { level: "hot", reasons, missing: [] }
    }
    const missing = [...missingAll, ...(anyOk ? [] : criteria.hot.any.slice(0, 1))]
    const warmOk = criteria.warm.all.every((requirement) => HAS[requirement](signals)) || signals.interest === "high"
    if (warmOk && signals.interest !== "low")
        return { level: "warm", reasons: [`missing for hot: ${missing.join(", ") || "-"}`], missing }
    return { level: "cold", reasons: [signals.interest === "low" ? "low interest" : "no clear need yet"], missing }
}

/** A hot lead goes to Sales only with a way to reach them and a need. */
export const handoffReady = (signals: Signals, flow: Identity): HandoffReadiness => {
    const contact = signals.contact ?? flow.phone ?? flow.email ?? flow.psid ?? flow.igsid ?? null
    return { ok: contact !== null && signals.need !== null, contact, need: signals.need }
}
