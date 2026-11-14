import { toolAnswerOf, type NodeHostPorts } from "@nivo-lite/agent-sdk/node"
import { NIVO_OWNER, mutatesBySpec, ownersOfTool, repeatableBySpec } from "@modules/domain/tool-specs"
import { EffectOutcomeUnknownCode, EffectOutcomeUnknownError, isOutcomeUnknownCode } from "./errors/graph-nodes.error"

/**
 * QUEUE-BUILD rule Q-2 / ruling R79 (engine words): a step that FAILS after one of its calls WROTE AT A PROVIDER (a tool a provider owns,
 * not NIVO's own) through a tool that does not declare itself `repeatable` (the write was answered, as a fresh act or as the receipt of an
 * earlier one) does not know what its business
 * now stands at: the write acted, the step did not finish. Such a failure is of the outcome-unknown class whatever the node said (`cannot`,
 * a throw, a confused AI, a failure of a later call): the run stops for a person at once, no `unsuccessful` ending, no AI output, no
 * automatic retry (a re-run would call the write again). The tool facts read are `mutates`, `repeatable` and its owner (a provider).
 */

/**
 * Whether a call of `id` writes at a provider and may NOT be made again: it mutates (`defined` is the tool's own word), a provider owns
 * it (NIVO's own writes are the engine's records, answered by its ledgers), and it does not declare itself `repeatable`.
 */
const unrepeatableWrite = (id: string, defined: boolean | undefined): boolean =>
    (mutatesBySpec(id) ?? defined ?? true) &&
    ownersOfTool(id).some((owner) => owner !== NIVO_OWNER) &&
    repeatableBySpec(id) !== true

/**
 * The host's ports of one node run with every answered non-repeatable write noted in `wrote` (in call order). Wraps the ports the node
 * is handed (outside the replay wrapper, so a write replayed from the checkpoint is noted too); a refusal is no write.
 */
export const writesNotedOf = (ports: NodeHostPorts, wrote: Array<string>): NodeHostPorts => ({
    ...ports,
    execute: async (effect, payload, call) => {
        const subject = await ports.execute(effect, payload, call)
        if (toolAnswerOf(subject).ok && unrepeatableWrite(effect.id, true)) wrote.push(effect.id)
        return subject
    },
    callTool: async (tool, args, key) => {
        const answer = await ports.callTool(tool, args, key)
        if (toolAnswerOf(answer).ok && unrepeatableWrite(tool.id, tool.mutates)) wrote.push(tool.id)
        return answer
    },
})

/** The code a failure names (a domain error's `code`), or null. */
const codeOf = (cause: unknown): string | null => {
    const code: unknown = typeof cause === "object" && cause !== null ? Reflect.get(cause, "code") : null
    return typeof code === "string" && code !== "" ? code : null
}

/**
 * What a node run's failure is once `wrote` holds the non-repeatable writes it made: the typed outcome-unknown failure naming the last
 * write and what the node failed with (`after`), or the failure as it was when nothing was written (or it already is outcome-unknown).
 */
export const failureAfterWrites = (cause: unknown, wrote: ReadonlyArray<string>): unknown => {
    const last = wrote.at(-1)
    if (last === undefined || isOutcomeUnknownCode(codeOf(cause))) return cause
    return new EffectOutcomeUnknownError({
        code: EffectOutcomeUnknownCode.Tool,
        params: { effect: last, after: codeOf(cause) ?? "failed", why: cause instanceof Error ? cause.message.slice(0, 300) : String(cause) },
    })
}
