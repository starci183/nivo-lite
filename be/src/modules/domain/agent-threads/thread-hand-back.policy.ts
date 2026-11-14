import { WAIT_ROUTE_MEMBER, WAIT_TIMEOUT_ROUTE } from "@nivo-lite/agent-sdk/graph"
import type { TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { triggerSpecOf } from "@modules/domain/trigger-specs"
import { isRecord } from "./thread-waits.policy"

/*
 * `handBack({ wait })` on a thread (`core.hand-back`, agreed with the SDK side: R11): the step gives back the event the named `wait`
 * took in this visit of it. Pure: which event, read from the wait's own output (`{ trigger: <key>, event }`) and the verb of that key.
 */

/** The engine's step id of a hand-back (the SDK compiles `handBack({ wait, next? })` to it, params `{ wait: <the wait's node key> }`). */
export const TEMPLATE_HAND_BACK_STEP = "core.hand-back"

/** The param of a hand-back that names its wait (a node key). */
export const HAND_BACK_WAIT_PARAM = "wait"

/** The refusal of a hand-back whose wait took no event (its timeout came, or it never ran in this visit): nothing to give back. */
export const HAND_BACK_NO_EVENT = "hand_back_no_event"

/** The event a wait took, as a hand-back gives it back: its verb, its id and the account it came through (none for an engine source). */
export interface HandBackEvent {
    readonly verb: TriggerVerb
    readonly eventId: string
    readonly accountId: string | null
}

/**
 * The event a wait's output names, or null when it names none (its `timeout` route, an output that is no wait's, a key its triggers do
 * not list, a verb the engine does not know, an event with no id). `on` is the wait's triggers as its params hold them.
 */
export const handBackEventOf = (output: unknown, on: unknown): HandBackEvent | null => {
    if (!isRecord(output)) return null
    const key = output[WAIT_ROUTE_MEMBER]
    const { event } = output
    if (typeof key !== "string" || key === WAIT_TIMEOUT_ROUTE || !isRecord(event) || !Array.isArray(on)) return null
    const entry: unknown = on.find((one: unknown) => isRecord(one) && one.key === key)
    const verb = isRecord(entry) && typeof entry.verb === "string" ? (triggerSpecOf(entry.verb)?.verb ?? null) : null
    const { eventId, accountId } = event
    if (verb === null || typeof eventId !== "string" || eventId === "") return null
    return { verb, eventId, accountId: typeof accountId === "string" && accountId !== "" ? accountId : null }
}

/**
 * The agent that handed a run off (its right to speak back on the customer's route, `NodeTurn.handedOffBy`): for a workflow call of the
 * one pipeline the trigger scope's `caller.agent` (`deliver` writes the calling agent; the flow adds its workflow), else the calling
 * agent the wake names as `authorAgentId`; null for a run no agent handed off (a customer's line, a person's start, a timer).
 */
export const handedOffByOf = (trigger: Readonly<Record<string, unknown>>): string | null => {
    const caller = trigger.caller
    if (isRecord(caller) && typeof caller.agent === "string" && caller.agent !== "") return caller.agent
    const author = trigger.authorAgentId
    return typeof author === "string" && author !== "" ? author : null
}
