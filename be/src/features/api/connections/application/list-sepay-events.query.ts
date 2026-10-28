import { Query } from "@nestjs/cqrs"
import type { SepayWebhookEvent } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListSepayEventsRequest } from "./list-sepay-events.contracts"

/** Asks for the newest webhook deliveries of one SePay connection. */
export class ListSepayEventsQuery extends Query<ReadonlyArray<SepayWebhookEvent>> {
    constructor(readonly params: ExecuteParams<ListSepayEventsRequest>) {
        super()
    }
}
