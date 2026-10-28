import type { SepayWebhookEvent } from "@modules/domain/channel-connections"
import type { ListSepayEventsRequest } from "../../application/list-sepay-events.contracts"
import type { ListSepayEventsInput } from "./dto/list-sepay-events.input"
import type { SepayWebhookEventType } from "./dto/sepay-webhook-event.type"

/** Maps the GraphQL arguments of sepayConnectionEvents to the request. */
export const toListSepayEventsRequest = (workspaceId: string, input: ListSepayEventsInput): ListSepayEventsRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of sepayConnectionEvents to the GraphQL types. */
export const toListSepayEventsType = (result: ReadonlyArray<SepayWebhookEvent>): Array<SepayWebhookEventType> =>
    result.map((event) => ({ ...event }))
