import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ListFreeTimesRequest, ListFreeTimesResult } from "./list-free-times.contracts"

/** Lists the free start times of a service on a day. */
export class ListFreeTimesQuery extends Query<ListFreeTimesResult> {
    constructor(readonly params: PublicExecuteParams<ListFreeTimesRequest>) {
        super()
    }
}
