import type { BrainFact } from "@/modules/types"

/** Whether a scheduled value is due to take over, or a value in force has ended: the brain needs bringing up to date. */
export const needsMaintenance = (facts: ReadonlyArray<BrainFact>, now: number): boolean =>
    facts.some(
        (fact) =>
            (fact.status === "scheduled" && fact.validFrom !== null && Date.parse(fact.validFrom) <= now) ||
            (fact.status === "active" && fact.validTo !== null && Date.parse(fact.validTo) < now),
    )

/** The current moment in milliseconds; a page asks for it once per read so the age of a value is judged against one instant. */
export const currentTime = (): number => Date.now()

/** An ISO instant from a day typed as YYYY-MM-DD, or undefined when it is empty or not a date. */
export const dayInstant = (text: string): string | undefined => {
    const time = Date.parse(text.trim())
    return Number.isFinite(time) ? new Date(time).toISOString() : undefined
}

/** What studying the corrections of an agent found. */
export interface MineOutcome {
    readonly corrections: number
    readonly newCases: number
    readonly proposed: number
    readonly reason: "not_enough" | "model_unavailable" | null
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const countOf = (value: unknown): number => (typeof value === "number" ? value : 0)

/** The outcome of studying corrections as the back end answered it. */
export const mineOutcomeOf = (result: unknown): MineOutcome => {
    const fields = isRecord(result) ? result : {}
    const reason = fields.reason
    return {
        corrections: countOf(fields.corrections),
        newCases: countOf(fields.newCases),
        proposed: countOf(fields.proposed),
        reason: reason === "not_enough" || reason === "model_unavailable" ? reason : null,
    }
}
