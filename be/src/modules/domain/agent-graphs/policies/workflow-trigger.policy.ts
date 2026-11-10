import {
    LATEST_VERSION,
    TRIGGER_SOURCES,
    WORKFLOW_CALL_MEMBER,
    WORKFLOW_PARAMS_MEMBER,
    conditionsHold,
} from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec, WorkflowCallPin, WorkflowTrigger } from "@nivo-lite/agent-sdk/graph"

/** The member of a hand-off's tag context that names the calling run. */
export const CALLER_MEMBER = "caller"

/**
 * The member of a trigger scope that lists what of the run's customer waits for the founder (a frozen workflow: the step it stopped
 * on, since when). The engine fills it when a run starts; the turn carries it to every agent of the run.
 */
export const WAITING_MEMBER = "waitingOnFounder"

/** The probe the evening close of the books is fired under; its slot is the `slotMs` a schedule trigger supplies. */
const CLOSE_PROBE = "accounting_close"

/** The subject kind of a bank credit the feed tags Accounting with; its id is the `transactionId` a SePay trigger supplies. */
const BANK_TRANSACTION = "bank-transaction"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The pin of an end hand-off a tag carries (the workflow and version it calls), or null for any other tag. */
export const workflowCallOf = (payload: Readonly<Record<string, unknown>>): WorkflowCallPin | null => {
    const call = payload[WORKFLOW_CALL_MEMBER]
    if (!isRecord(call) || typeof call.workflow !== "string" || call.workflow === "") return null
    const version = call.version
    if (version === LATEST_VERSION) return { workflow: call.workflow, version }
    return typeof version === "number" && Number.isSafeInteger(version) && version > 0
        ? { workflow: call.workflow, version }
        : null
}

/** The run that called, as the hand-off named it. */
const callerRunOf = (payload: Readonly<Record<string, unknown>>): string | null => {
    const caller = payload[CALLER_MEMBER]
    return isRecord(caller) && typeof caller.runId === "string" ? caller.runId : null
}

/** What a wake brings that the contract-form trigger scope reads. */
export interface ContractWake {
    /** The members the door wrote, flat. */
    readonly members: Readonly<Record<string, unknown>>
    /** The plain data of the tag. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The subject as `{ kind, id }`, or null. */
    readonly subject: { readonly kind: string; readonly id: string } | null
}

/**
 * The params a wake supplies at the top of the trigger scope (`trigger.<name>`), beyond the members its door wrote:
 * - an end hand-off passes ONLY its mapped params, plus `caller` (the agent that called and its run; the workflow is added by the run
 *   engine, which can read the caller's pin);
 * - any other tag's plain data, member by member, where the door wrote no member of that name (a care timer's `careKind`, a website
 *   order's `request`);
 * - a bank credit's `transactionId`, and the evening close's `slotMs`.
 */
export const suppliedScopeOf = (wake: ContractWake): Readonly<Record<string, unknown>> => {
    const { members, payload, subject } = wake
    const call = workflowCallOf(payload)
    const fromPayload: Readonly<Record<string, unknown>> =
        call === null
            ? Object.fromEntries(Object.entries(payload).filter(([name]) => !(name in members)))
            : {
                  ...(isRecord(payload[WORKFLOW_PARAMS_MEMBER]) ? payload[WORKFLOW_PARAMS_MEMBER] : {}),
                  [CALLER_MEMBER]: {
                      agent: typeof members.authorAgentId === "string" ? members.authorAgentId : null,
                      workflow: null,
                      runId: callerRunOf(payload),
                  },
              }
    const slot = Number(members.slot)
    return {
        ...fromPayload,
        ...(subject?.kind === BANK_TRANSACTION ? { transactionId: subject.id } : {}),
        ...(members.probeKey === CLOSE_PROBE && Number.isSafeInteger(slot) && slot > 0 ? { slotMs: slot } : {}),
    }
}

/** The channel kind of a wake: the conversation's channel, else the prefix of the channel event (`zalo:<id>`), else null. */
export const channelOf = (scope: Readonly<Record<string, unknown>>): string | null => {
    if (typeof scope.channel === "string" && scope.channel !== "") return scope.channel
    const event = scope.channelEventId
    if (typeof event !== "string") return null
    const at = event.indexOf(":")
    return at > 0 ? event.slice(0, at) : null
}

/** Whether one trigger takes a wake: the wake arrives as the trigger's kind, on its channel and connection, and meets its conditions. */
export const triggerTakes = (trigger: WorkflowTrigger, source: string, scope: Readonly<Record<string, unknown>>): boolean => {
    const info = TRIGGER_SOURCES[trigger.source.kind]
    if (info.wake !== source) return false
    const channel = channelOf(scope)
    if (info.wake === "channel" && channel !== null && channel !== trigger.source.kind) return false
    const connectionId = trigger.source.connectionId
    if (connectionId !== null && typeof scope.connectionId === "string" && scope.connectionId !== connectionId) return false
    return conditionsHold(trigger.conditions, scope)
}

/** The key of the first trigger of a graph that takes a wake, or null; a graph without typed triggers is taken by its sources alone. */
export const takingTriggerOf = (
    spec: GraphSpec,
    source: string,
    scope: Readonly<Record<string, unknown>>,
): string | null => {
    if (spec.triggers === undefined) return spec.trigger.sources.some((one) => one === source) ? "" : null
    return spec.triggers.find((trigger) => triggerTakes(trigger, source, scope))?.key ?? null
}
