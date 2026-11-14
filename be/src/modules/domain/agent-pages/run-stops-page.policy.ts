import { approvalOf, stopCardKindOf, stopCardStateOf, type RunStop } from "@modules/domain/agent-threads"
import type { RunStopView } from "./run-stops-page.contracts"

/** The page size when the request names none. */
const PAGE_SIZE = 20

/** The largest page. */
const PAGE_MAX = 50

/** The deepest position a cursor may name: the stops store answers the newest of a state, at most 100 at once. */
export const DEPTH_MAX = 100

/** The names a page reads beside its stops. */
export interface RunStopNames {
    /** Agent names by agent. */
    readonly agents: ReadonlyMap<string, string>
    /** Workflow names by run. */
    readonly workflows: ReadonlyMap<string, string>
    /** Customer names by contact. */
    readonly contacts: ReadonlyMap<string, string>
}

/** The position a cursor names; 0 for none or one of another shape. */
export const offsetOf = (cursor: string | null | undefined): number => {
    const at = Number(cursor ?? "0")
    return Number.isSafeInteger(at) && at > 0 ? Math.min(at, DEPTH_MAX) : 0
}

/** The page size a request asks for, within its bounds. */
export const sizeOf = (limit: number | null | undefined): number => Math.min(Math.max(limit ?? PAGE_SIZE, 1), PAGE_MAX)

/** One open stop with what answering it needs and the names beside it. */
export const viewOf = (stop: RunStop, names: RunStopNames): RunStopView => ({
    stopId: stop.id,
    runId: stop.runId,
    stepKey: stop.stepKey,
    kind: stopCardKindOf(stop),
    reason: stop.reason,
    question: stop.question,
    suggestions: stop.detail.suggestions.map((suggestion) => suggestion.text),
    needs: stopCardStateOf(stop).needs,
    approval: stop.kind === "approval" ? approvalOf(stop) : null,
    agentId: stop.agentId,
    agentName: names.agents.get(stop.agentId) ?? null,
    workflowId: stop.workflowId,
    workflowName: names.workflows.get(stop.runId) ?? null,
    contactId: stop.contactId,
    contactName: stop.contactId === null ? null : (names.contacts.get(stop.contactId) ?? null),
    conversationId: stop.conversationId,
    repeats: stop.repeats,
    stoppedAt: stop.stoppedAt,
})
