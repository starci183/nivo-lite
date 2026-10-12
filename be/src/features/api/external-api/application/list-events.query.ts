import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ListEventsRequest, ListEventsResult } from "./list-events.contracts"

/** Asks for the evidence log of the workspace the API key acts for. */
export class ListEventsQuery extends Query<ListEventsResult> {
    constructor(readonly params: PublicExecuteParams<ListEventsRequest>) {
        super()
    }
}
