import type { ListEventsRequest, ListEventsResult } from "../../application/list-events.contracts"
import type { ListEventsRequest as ListEventsHttpRequest } from "./dto/list-events.request"
import type { ListEventsResponse } from "./dto/list-events.response"

/** Maps the HTTP request to the query request. */
export const toListEventsRequest = (
    authorization: string | undefined,
    input: ListEventsHttpRequest,
): ListEventsRequest => ({
    authorization,
    since: input.since,
    limit: input.limit,
})

/** Maps the query result to the HTTP response. */
export const toListEventsResponse = (result: ListEventsResult): ListEventsResponse => ({
    data: {
        events: result.events.map((event) => ({
            id: event.id,
            kind: event.kind,
            actor: event.actor,
            summary: event.summary,
            evidence: event.evidence,
            lead_id: event.leadId,
            created_at: event.createdAt,
        })),
        next_since: result.nextSince,
    },
})
