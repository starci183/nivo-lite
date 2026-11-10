import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { FreezeStatus, LeadFreeze, PendingContextValue, PendingEvent, PendingKind } from "./lead-freezes.contracts"

const STATUSES: ReadonlyArray<FreezeStatus> = ["frozen", "retrying", "released"]
const KINDS: ReadonlyArray<PendingKind> = ["message", "payment", "timer", "handoff", "event"]

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

const numberOf = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0)

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const statusOf = (value: unknown): FreezeStatus => STATUSES.find((status) => status === value) ?? "released"

const kindOf = (value: unknown): PendingKind => KINDS.find((kind) => kind === value) ?? "event"

const contextOf = (value: unknown): Readonly<Record<string, PendingContextValue>> =>
    isObject(value)
        ? Object.fromEntries(
              Object.entries(value).filter(
                  (entry): entry is [string, PendingContextValue] =>
                      typeof entry[1] === "string" || typeof entry[1] === "boolean",
              ),
          )
        : {}

/** One pending event as the record keeps it; null for an entry that is not one. */
const pendingEventOf = (value: unknown): PendingEvent | null => {
    if (!isObject(value)) return null
    const wakeId = textOf(value.wakeId)
    const agentId = textOf(value.agentId)
    if (wakeId === null || agentId === null) return null
    const ids = Array.isArray(value.messageIds)
        ? value.messageIds.filter((id): id is string => typeof id === "string")
        : []
    return {
        wakeId,
        agentId,
        source: textOf(value.source) ?? "",
        eventKey: textOf(value.eventKey) ?? wakeId,
        scopeKey: textOf(value.scopeKey) ?? "",
        context: contextOf(value.context),
        actorMemberId: textOf(value.actorMemberId),
        kind: kindOf(value.kind),
        at: textOf(value.at) ?? "",
        conversationId: textOf(value.conversationId),
        messageIds: ids,
        folded: value.folded === true,
    }
}

/** The pending events a record keeps under `{ events }`, in order; an entry that is not one is skipped. */
export const pendingOf = (value: unknown): ReadonlyArray<PendingEvent> => {
    const events = isObject(value) ? value.events : undefined
    return Array.isArray(events) ? events.flatMap((each) => pendingEventOf(each) ?? []) : []
}

/** The pending events as the record stores them: `{ events: [...] }` of plain JSON. */
export const pendingJsonOf = (pending: ReadonlyArray<PendingEvent>): JsonValue => ({
    events: pending.map((each) => ({
        wakeId: each.wakeId,
        agentId: each.agentId,
        source: each.source,
        eventKey: each.eventKey,
        scopeKey: each.scopeKey,
        context: { ...each.context },
        actorMemberId: each.actorMemberId,
        kind: each.kind,
        at: each.at,
        conversationId: each.conversationId,
        messageIds: [...each.messageIds],
        folded: each.folded,
    })),
})

/** The freeze of a record row. */
export const freezeOf = (row: RecordRow): LeadFreeze => {
    const data = row.data
    return {
        id: row.id,
        version: row.version,
        key: textOf(data.key) ?? "",
        leadId: textOf(data.leadId),
        conversationId: textOf(data.conversationId),
        status: statusOf(data.status),
        frozenRunId: textOf(data.frozenRunId),
        agentId: textOf(data.agentId),
        frozenAt: textOf(data.frozenAt),
        frozenReason: textOf(data.frozenReason),
        stepKey: textOf(data.stepKey),
        stepTitle: textOf(data.stepTitle),
        customerName: textOf(data.customerName),
        workItemId: textOf(data.workItemId),
        episode: numberOf(data.episode),
        failures: numberOf(data.failures),
        heldBy: textOf(data.heldBy),
        releasedAt: textOf(data.releasedAt),
        releasedBy: textOf(data.releasedBy),
        releaseReason: textOf(data.releaseReason),
        pending: pendingOf(data.pending),
    }
}
