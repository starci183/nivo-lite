import type { InboundEventFeedRow } from "@modules/domain/inbound-events"
import type { ListInboundEventsRequest } from "../../application/list-inbound-events.contracts"
import type { InboundEventsInput } from "./dto/inbound-events.input"
import type { InboundEventType } from "./dto/inbound-event.type"

/** Selects a bounded feed from the workspace header and GraphQL input. */
export const toInboundEventsRequest = (workspaceId: string, input: InboundEventsInput): ListInboundEventsRequest => ({
    workspaceId,
    limit: input.limit,
})

/** Maps persisted feed rows to the public GraphQL fields. */
export const toInboundEventsType = (rows: ReadonlyArray<InboundEventFeedRow>): Array<InboundEventType> =>
    rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        kind: row.kind,
        origin: row.origin,
        senderName: row.sender_name,
        senderContact: row.sender_contact,
        body: row.body,
        amountVnd: row.amount_vnd,
        externalRef: row.external_ref,
        eventId: row.event_id,
        duplicateCount: row.duplicate_count,
        leadId: row.lead_id,
        status: row.status,
        createdAt: row.created_at,
    }))
