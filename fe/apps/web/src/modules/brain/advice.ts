import type { BrainFact } from "@/modules/types"
import { TRUST, keyOf } from "./keys"

/** What NIVO suggests doing with a proposal. */
export type ReviewAction = "apply" | "schedule" | "reject" | "split" | "ask"

/** NIVO's suggestion for a proposal, with the catalog key (`brain` namespace) and the values of its reason. */
export interface ReviewAdvice {
    readonly action: ReviewAction
    readonly reasonKey: string
    readonly params: Readonly<Record<string, string | number>>
}

/** Words that make a value conditional: two such values may both be true, for different situations. */
const CONDITIONS = [
    "cuoi-tuan",
    "ngay-thuong",
    "thu-7",
    "thu-bay",
    "chu-nhat",
    "ngay-le",
    "le-tet",
    "tet",
    "buoi-toi",
    "buoi-sang",
    "vip",
    "sinh-vien",
    "khach-moi",
    "thanh-vien",
    "online",
    "tai-cho",
    "weekend",
    "weekday",
    "holiday",
    "member",
    "student",
]
const STALE_DAYS = 120
const DAY_MS = 86_400_000

const conditionsOf = (value: string): ReadonlyArray<string> => {
    const key = `-${keyOf(value)}-`
    return CONDITIONS.filter((condition) => key.includes(`-${condition}-`))
}

const dayOf = (iso: string): string => iso.slice(0, 10).split("-").reverse().join("/")

/** The first suggestion that fits a proposal that has no value in force to replace. */
const firstValue = (p: BrainFact): ReviewAdvice =>
    p.trust >= TRUST.staff
        ? { action: "apply", reasonKey: "reasonFirstTrusted", params: { who: p.proposedBy, trust: p.trust } }
        : { action: "ask", reasonKey: "reasonFirstUntrusted", params: { trust: p.trust } }

/**
 * NIVO's suggestion for a proposal. Deterministic (no model call), checked in this order: a later start date schedules it; a value tied
 * to a situation the current one is not suggests two facts; fresh figures from a connected system backed by a record apply; a much less
 * trusted source (a customer, the model's guess) suggests rejecting; a source at least as trusted, or a value nobody confirmed for
 * months, suggests applying; anything else: ask the person who proposed it.
 */
export const adviceFor = (p: BrainFact, current: BrainFact | null, now: number): ReviewAdvice => {
    if (p.validFrom !== null && Date.parse(p.validFrom) > now) {
        return {
            action: "schedule",
            reasonKey: current === null ? "reasonScheduleNew" : "reasonSchedule",
            params: { date: dayOf(p.validFrom), current: current?.value ?? "" },
        }
    }
    if (current === null) return firstValue(p)
    const newConditions = conditionsOf(p.value).filter((condition) => !conditionsOf(current.value).includes(condition))
    if (newConditions.length > 0) {
        return {
            action: "split",
            reasonKey: "reasonSplit",
            params: { value: p.value, current: current.value, situation: newConditions.join(", ").replace(/-/g, " ") },
        }
    }
    if (p.sourceKind === "system" && p.evidence.some((item) => item.kind === "data_record")) {
        return { action: "apply", reasonKey: "reasonSystem", params: { who: p.proposedBy, current: current.value } }
    }
    if (p.trust + 20 <= current.trust && (p.sourceKind === "customer" || p.sourceKind === "ai")) {
        return {
            action: "reject",
            reasonKey: p.sourceKind === "customer" ? "reasonRejectCustomer" : "reasonRejectAi",
            params: {
                current: current.value,
                by: current.decidedBy ?? current.proposedBy,
                currentTrust: current.trust,
                trust: p.trust,
            },
        }
    }
    const confirmedAt = Date.parse(current.decidedAt ?? current.proposedAt)
    const staleDays = Math.floor((now - confirmedAt) / DAY_MS)
    if (p.trust >= current.trust) {
        return {
            action: "apply",
            reasonKey: "reasonNewer",
            params: { who: p.proposedBy, trust: p.trust, currentTrust: current.trust, current: current.value },
        }
    }
    if (staleDays >= STALE_DAYS) {
        return { action: "apply", reasonKey: "reasonStale", params: { current: current.value, days: staleDays } }
    }
    return {
        action: "ask",
        reasonKey: "reasonAsk",
        params: { who: p.proposedBy, trust: p.trust, currentTrust: current.trust },
    }
}
