import { REFUSED_KIND, isRefused } from "@nivo-lite/agent-sdk/node"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"

/** The true values a tool read or wrote, beside the subject it answers: amounts and states from the records, never from the caller. */
export type EffectFacts = { readonly [name: string]: JsonValue }

/** What a tool answers: the subject it touched, with the true values beside it. An agent reads `facts` instead of computing a number. */
export interface EffectFact extends SubjectRef {
    /** The values the tool read or wrote; absent when the subject says it all. */
    readonly facts?: EffectFacts | undefined
}

/** The kind of the fact a tool answers when it refuses on business grounds: the SDK's own, under the name the tools use. */
export const EFFECT_REFUSED: typeof REFUSED_KIND = REFUSED_KIND

/** The refusal of a tool: why (`id`), and the true values that explain it. A refusal is an answer the agent reads, never a throw. */
export const refusalOf = (reason: string, facts: EffectFacts = {}): EffectFact => ({
    kind: REFUSED_KIND,
    id: reason,
    facts,
})

/** Whether what a tool answered is a refusal. */
export const isRefusal: (fact: SubjectRef) => boolean = isRefused
