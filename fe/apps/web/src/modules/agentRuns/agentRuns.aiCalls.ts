import type { AgentRunAiCallsQuery } from "@/modules/api"

/** One call kind of a run as the back end answers it. */
export type AiCallWire = NonNullable<AgentRunAiCallsQuery["agentRun"]>["aiCalls"][number]

/** One row of the "AI calls" table: each column's main figure and, under it, its 12 muted line (empty when there is none). */
export interface AiCallRowView {
    readonly id: string
    readonly purpose: string
    /** The finish reasons that are not a normal end ("length"), or "". */
    readonly finish: string
    readonly calls: string
    readonly callsNote: string
    readonly prompt: string
    readonly promptNote: string
    readonly completion: string
    readonly completionNote: string
    readonly time: string
    readonly timeNote: string
    readonly cost: string
    readonly model: string
}

/** The words of the table's secondary lines and the reader's number formats (next-intl's formatter, from the hook). */
export interface AiCallWords {
    readonly count: (value: number) => string
    /** Seconds with one decimal. */
    readonly decimal: (value: number) => string
    /** US dollars with four decimals. */
    readonly usd: (value: number) => string
    /** The name of a call kind: its words, else the label the back end sent (null when it sent none), else the run's step. */
    readonly purposeOf: (purpose: string, label: string | null) => string
    readonly maxTry: (count: string) => string
    readonly cached: (count: string) => string
    readonly reasoning: (count: string) => string
    readonly seconds: (value: string) => string
    readonly slowest: (value: string) => string
    readonly finish: (reasons: string) => string
}

/** The ends of a call that are normal: the answer finished, or it asked for a tool. */
const NORMAL_FINISH = new Set(["stop", "end_turn", "tool_calls", "tool-calls", "tool_use", "normal", ""])

/** A whole number that is set and above one. */
const isAboveOne = (value: number | null | undefined): value is number => value !== null && value !== undefined && value > 1

/** The AI calls of a run as rows, in the order the back end sends them (the order of each kind's first call). */
export const aiCallRowsOf = (calls: ReadonlyArray<AiCallWire>, words: AiCallWords): ReadonlyArray<AiCallRowView> => {
    const { count } = words
    return calls.map((call) => {
        const odd = call.finishReasons.filter((reason) => !NORMAL_FINISH.has(reason))
        const models = call.models.length > 0 ? call.models : call.upstreams
        return {
            id: call.purpose,
            purpose: words.purposeOf(call.purpose, call.label ?? null),
            finish: odd.length === 0 ? "" : words.finish(odd.join(", ")),
            calls: count(call.calls),
            callsNote: isAboveOne(call.maxTry) ? words.maxTry(count(call.maxTry)) : "",
            prompt: count(call.promptTokens),
            promptNote: call.cachedTokens > 0 ? words.cached(count(call.cachedTokens)) : "",
            completion: count(call.completionTokens),
            completionNote: call.reasoningTokens > 0 ? words.reasoning(count(call.reasoningTokens)) : "",
            time: words.seconds(words.decimal(call.durationMs / 1000)),
            timeNote:
                call.calls > 1 && call.slowestMs !== null ? words.slowest(words.decimal(call.slowestMs / 1000)) : "",
            cost: words.usd(call.costUsd),
            model: models.join(", "),
        }
    })
}
