import { Query } from "@nestjs/cqrs"
import type { ZaloPageEvent } from "@modules/domain/channels"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListZaloEventsRequest } from "./list-zalo-events.contracts"

/** Asks for the live events of a Zalo OA connection. */
export class ListZaloEventsQuery extends Query<ReadonlyArray<ZaloPageEvent>> {
    constructor(readonly params: ExecuteParams<ListZaloEventsRequest>) {
        super()
    }
}
