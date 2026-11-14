import type { GraphSpecNode, NoticeFactSpec, UnsuccessfulThen } from "@nivo-lite/agent-sdk/graph"
import type { ParamBinding } from "@nivo-lite/agent-sdk/node"
import type { MessageFact } from "@nivo-lite/agent-sdk/team-chat"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { StepMiss } from "@modules/domain/graph-nodes"

/*
 * R68 (owner 2026-11-14, "cook luôn"): graphs hold pure business; an UNSUCCESSFUL step is reported to the team by the ENGINE. A step that
 * declares `unsuccessful` and ends in a TYPED non-success (a customer send refused other than `route_held`, an approval declined, the
 * node's `cannot`), or an `until` loop that declares it and runs out of rounds, gets ONE team notice (the engine's own `report.facts`
 * card) and the run follows the step's one policy word. A failure (a throw, a confused AI, an outcome-unknown call, an engine stop) is NOT
 * this: it keeps the stop card and the stop that holds its subject. Pure: the words come from the catalogue, the values from the step's own refs.
 */

/** The code a node's `ctx.fail({ kind: "cannot" })` ends with (the SDK's template host names it so). */
export const NODE_CANNOT = "NODE_CANNOT"

/** Why a step ended unsuccessfully: a miss of one of its calls, the node's own `cannot`, or a loop out of rounds. */
export type StepEndingReason =
    | StepMiss
    | {
          /** The node said it cannot do its business (`ctx.fail({ kind: "cannot", why })`). */
          readonly kind: "cannot"
          /** The node's own words of why, as it wrote them. */
          readonly why: string
      }
    | {
          /** An `until` loop ran every round its `max` allows without its condition. */
          readonly kind: "exhausted"
          /** The rounds it ran. */
          readonly rounds: number
      }

/** A node step's declared ending: its policy word, the outcome step it ends at, and its notice facts. */
export interface UnsuccessfulEnding {
    /** `continue` (the step's own exit) or `end` (the outcome step `outcome`). */
    readonly then: UnsuccessfulThen
    /** The outcome step of an `end`; null with `continue`. */
    readonly outcome: string | null
    /** The facts the notice carries beside the reason. */
    readonly facts: ReadonlyArray<NoticeFactSpec>
}

/** A node step's declared ending, or null when it declares none (or only a loop's facts: an `until` loop reports through `loopNoticeOf`). */
export const stepEndingOf = (node: GraphSpecNode | undefined): UnsuccessfulEnding | null => {
    const declared = node?.unsuccessful
    if (declared === undefined || !("then" in declared)) return null
    const outcome = declared.then === "end" && declared.outcome !== undefined ? declared.outcome : null
    // An `end` with no outcome is refused at save; a stored one that slipped through goes on rather than end nowhere.
    return { then: outcome === null ? "continue" : declared.then, outcome, facts: declared.facts }
}

/** The facts of an `until` loop's notice when it runs out of rounds, or null when the loop declares none (it goes quietly). */
export const loopNoticeOf = (node: GraphSpecNode | undefined): ReadonlyArray<NoticeFactSpec> | null => {
    const declared = node?.unsuccessful
    return declared === undefined || "then" in declared ? null : declared.facts
}

/** The outcome step an unsuccessful ending of `node` may go to, for the thread compiler's `ends`; none for `continue`. */
export const endingTargetsOf = (node: GraphSpecNode): ReadonlyArray<string> => {
    const ending = stepEndingOf(node)
    return ending === null || ending.outcome === null ? [] : [ending.outcome]
}

/** The key the one notice of a step attempt is posted under: a replay or a re-drive of the same attempt posts nothing new. */
export const endingNoticeKeyOf = (runId: string, stepKey: string, attempt: number): string =>
    `step-ending:${runId}:${stepKey}:${String(attempt)}`

/** The catalogue key of the notice's sentence for a reason. */
export const endingSentenceKeyOf = (reason: StepEndingReason): string => {
    switch (reason.kind) {
        case "send_refused":
            return "agentGraphs.stepEnding.sendRefused"
        case "declined":
            return "agentGraphs.stepEnding.declined"
        case "cannot":
            return "agentGraphs.stepEnding.cannot"
        case "exhausted":
            return "agentGraphs.stepEnding.exhausted"
    }
}

/** The typed reason as the notice's technical fact: the refusal code, `declined` with the tool, the node's code and words, the rounds. */
export const reasonValueOf = (reason: StepEndingReason): string => {
    switch (reason.kind) {
        case "send_refused":
            return reason.refusal
        case "declined":
            return `declined (${reason.tool})`
        case "cannot":
            return `${NODE_CANNOT}: ${reason.why}`
        case "exhausted":
            return String(reason.rounds)
    }
}

/** The most characters one fact value of a notice keeps (the card's own bound is 400). */
const FACT_VALUE_MAX = 300

/** A resolved fact value as words: text, a number, a yes/no, a list of those; null for nothing (the fact is then left out). */
export const factWordsOf = (value: unknown): string | null => {
    if (typeof value === "string") return value === "" ? null : value.slice(0, FACT_VALUE_MAX)
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (Array.isArray(value)) {
        const parts = value.flatMap((one: unknown) => {
            const words = factWordsOf(one)
            return words === null ? [] : [words]
        })
        return parts.length === 0 ? null : parts.join(", ").slice(0, FACT_VALUE_MAX)
    }
    if (typeof value === "object" && value !== null) {
        const text = JSON.stringify(value)
        return text === "{}" ? null : text.slice(0, FACT_VALUE_MAX)
    }
    return null
}

/** The declared facts as bindings by their place (`"0"`, `"1"`, ...): what the engine resolves against the step's scope. */
export const factBindingsOf = (facts: ReadonlyArray<NoticeFactSpec>): Readonly<Record<string, ParamBinding>> =>
    Object.fromEntries(facts.map((fact, index) => [String(index), fact.value]))

/** The declared facts as the notice's facts: each label in the team's language beside its resolved value, those that read nothing left out. */
export const declaredFactsOf = (
    facts: ReadonlyArray<NoticeFactSpec>,
    resolved: Readonly<Record<string, unknown>>,
    labelOf: (label: SpecText) => string,
): ReadonlyArray<MessageFact> =>
    facts.flatMap((fact, index) => {
        const value = factWordsOf(resolved[String(index)])
        return value === null ? [] : [{ name: labelOf(fact.label), value }]
    })
