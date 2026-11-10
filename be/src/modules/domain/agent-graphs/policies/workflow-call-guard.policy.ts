import { createHash } from "node:crypto"

/** The most workflows one chain of calls may hold, the first included: a call past it is refused. */
export const CALL_DEPTH_MAX = 8

/** The statuses of a run that still stands for its lead: a second run of the same call would answer it twice. */
export const STANDING_RUN: ReadonlySet<string> = new Set(["running", "waiting", "parked"])

/** Why the engine refused to start a called workflow; each is recorded on the wake as an infrastructure event. */
export type CallRefusal =
    /** The calling run is not a run of this workspace (or is gone): a call never crosses workspaces. */
    | "call_caller_unknown"
    /** The target takes calls only from the workflows of its own agent. */
    | "call_not_open"
    /** The chain of calls is longer than the depth limit. */
    | "call_too_deep"
    /** The target already runs in this chain for the same lead with the same params: A calls B calls A. */
    | "call_cycle"
    /** A run of the same target for the same lead with the same params still stands. */
    | "call_duplicate"

/** What a wake says of the call that made it: the calling run and the params it passed. */
export interface WorkflowCallFacts {
    /** The calling run. */
    readonly callerRunId: string
    /** The params the caller mapped, as plain data. */
    readonly params: Readonly<Record<string, unknown>>
}

/** One workflow of a chain of calls, as the guards compare them. */
export interface CallLink {
    /** The agent. */
    readonly agentId: string
    /** The workflow, or the agent's own graph when the run is pinned to none. */
    readonly workflow: string
    /** The lead it served, or null. */
    readonly leadId: string | null
    /** The digest of the params it was called with. */
    readonly paramHash: string
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The call a tag's plain data names (`caller.runId` and `params`, as `core.call-workflow` writes them), or null for a wake no call made. */
export const callOf = (payload: unknown): WorkflowCallFacts | null => {
    if (!isRecord(payload) || !isRecord(payload.caller)) return null
    const callerRunId = textOf(payload.caller.runId)
    if (callerRunId === null) return null
    return { callerRunId, params: isRecord(payload.params) ? payload.params : {} }
}

/** Plain data with every object's members in key order, so the same params give the same text. */
const canonicalOf = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalOf)
    if (!isRecord(value)) return value
    return Object.fromEntries(
        Object.keys(value)
            .sort((left, right) => left.localeCompare(right))
            .map((key) => [key, canonicalOf(value[key])]),
    )
}

/** The digest of the params of a call: the same params, in any member order, give the same digest. */
export const paramHashOf = (params: Readonly<Record<string, unknown>>): string =>
    createHash("sha256")
        .update(JSON.stringify(canonicalOf(params)))
        .digest("hex")

/** The lead a call is about: the trigger's own, else the one its params pass. */
export const callLeadOf = (trigger: Readonly<Record<string, unknown>>, call: WorkflowCallFacts): string | null =>
    textOf(trigger.leadId) ?? textOf(call.params.leadId)

/** Whether two links are the same workflow for the same lead with the same params. */
const sameLink = (left: CallLink, right: CallLink): boolean =>
    left.agentId === right.agentId &&
    left.workflow === right.workflow &&
    left.leadId === right.leadId &&
    left.paramHash === right.paramHash

/**
 * Why a call is refused by its chain, or null when it may start. `chain` holds the workflows that led to the call, nearest first: the
 * call is refused past the depth limit, and when the target already runs in the chain for the same lead with the same params.
 */
export const chainRefusalOf = (target: CallLink, chain: ReadonlyArray<CallLink>): CallRefusal | null => {
    if (chain.some((link) => sameLink(link, target))) return "call_cycle"
    return chain.length + 1 > CALL_DEPTH_MAX ? "call_too_deep" : null
}

/** Whether a standing run duplicates the call: the same workflow for the same lead with the same params. */
export const duplicates = (target: CallLink, standing: CallLink): boolean => sameLink(standing, target)
