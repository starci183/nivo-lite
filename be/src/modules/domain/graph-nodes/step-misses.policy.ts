import { TOOL, type CustomerMessageSendRefusal, type ToolId } from "@nivo-lite/agent-sdk/names"
import { toolAnswerOf, type NodeRun } from "@nivo-lite/agent-sdk/node"
import type { DeclinedRefusal } from "@nivo-lite/agent-sdk/template"

/**
 * One call of a step that did not do what it was made for, as the engine reports it (ruling R68): the ONE customer send refused (any
 * typed refusal but `route_held`: under a staff hold a person serves the customer, so it is no miss), or any call whose approval a person
 * declined. Read from the call's typed ANSWER only (its codes), never from words; the node itself still reads the answer as before.
 */
export type StepMiss =
    | {
          /** The customer send answered a refusal. */
          readonly kind: "send_refused"
          /** The tool called (the customer send). */
          readonly tool: string
          /** Its typed refusal code. */
          readonly refusal: string
      }
    | {
          /** A person declined the approval the call asked for. */
          readonly kind: "declined"
          /** The tool whose call was declined. */
          readonly tool: string
      }

/** What a node run came to on the template road: the SDK's run, with the misses its calls answered (none on the `defineNode` road). */
export interface HostedNodeRun extends NodeRun {
    /** The calls of the step that missed, once each, in call order; absent or empty: none. */
    readonly misses?: ReadonlyArray<StepMiss> | undefined
}

/** The refusal of the customer send that is no miss: a member of the shop holds the route (R45: quiet). */
const ROUTE_HELD: CustomerMessageSendRefusal = "route_held"

/** The engine's code of a declined approval on the wire. */
const DECLINED: DeclinedRefusal = "declined"

/**
 * A customer send's receipt that says it was refused (`{ state: "refused", reason }`: the send's ledger answers a key it settled refused
 * with its receipt): the same miss as the refusal answer; null for a delivered or uncertain receipt, and for `route_held`.
 */
const refusedReceiptOf = (tool: ToolId, value: unknown): StepMiss | null => {
    if (typeof value !== "object" || value === null) return null
    const state: unknown = Reflect.get(value, "state")
    const reason: unknown = Reflect.get(value, "reason")
    if (state !== "refused" || typeof reason !== "string" || reason === "" || reason === ROUTE_HELD) return null
    return { kind: "send_refused", tool, refusal: reason }
}

/** The miss one call's raw answer is, or null for an answer that is no miss (a success, any refusal of another tool, `route_held`). */
export const missOfAnswer = (tool: ToolId, raw: unknown): StepMiss | null => {
    const answer = toolAnswerOf(raw)
    if (answer.ok) return tool === TOOL.customerMessageSend ? refusedReceiptOf(tool, answer.value) : null
    if (answer.refusal === DECLINED) return { kind: "declined", tool }
    if (tool !== TOOL.customerMessageSend || answer.refusal === ROUTE_HELD) return null
    return { kind: "send_refused", tool, refusal: answer.refusal }
}

/** Adds a miss to the list once: the same call answered again (a replay, an agent's repeat) is one miss. */
export const withMiss = (misses: Array<StepMiss>, miss: StepMiss | null): void => {
    if (miss === null) return
    const same = (one: StepMiss): boolean =>
        one.kind === miss.kind && one.tool === miss.tool && (one.kind !== "send_refused" || miss.kind !== "send_refused" || one.refusal === miss.refusal)
    if (!misses.some(same)) misses.push(miss)
}
