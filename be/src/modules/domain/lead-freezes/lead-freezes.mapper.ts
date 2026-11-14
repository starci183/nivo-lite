import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { jsonObjectOf } from "./lead-freeze.policy"
import type { ContactFreezeEntity } from "./persistence/entities"
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
        ...(isObject(value.trigger) ? { trigger: jsonObjectOf(value.trigger) } : {}),
        ...(typeof value.taken === "string" && value.taken !== "" ? { taken: value.taken } : {}),
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
        ...(each.trigger === undefined ? {} : { trigger: each.trigger }),
        ...(each.taken === undefined ? {} : { taken: each.taken }),
    })),
})

const isoOf = (value: Date | null): string | null => (value === null ? null : value.toISOString())

/** The freeze a row of the freezes table holds. */
export const freezeOf = (row: ContactFreezeEntity): LeadFreeze => ({
    id: row.id,
    version: String(row.version),
    key: row.key,
    contactId: textOf(row.contactId),
    conversationId: textOf(row.conversationId),
    status: statusOf(row.status),
    frozenRunId: textOf(row.frozenRunId),
    agentId: textOf(row.agentId),
    frozenAt: isoOf(row.frozenAt),
    frozenReason: textOf(row.frozenReason),
    stepKey: textOf(row.stepKey),
    stepTitle: textOf(row.stepTitle),
    customerName: textOf(row.customerName),
    workItemId: textOf(row.workItemId),
    episode: numberOf(row.episode),
    failures: numberOf(row.failures),
    heldBy: textOf(row.heldBy),
    releasedAt: isoOf(row.releasedAt),
    releasedBy: textOf(row.releasedBy),
    releaseReason: textOf(row.releaseReason),
    pending: pendingOf(row.pending),
})
