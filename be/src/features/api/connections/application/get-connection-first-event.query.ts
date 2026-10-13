import { Query } from "@nestjs/cqrs"
import type { FirstEventState } from "@modules/domain/connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetConnectionFirstEventRequest } from "./get-connection-first-event.contracts"

/** Asks whether the first event of a connection has arrived. */
export class GetConnectionFirstEventQuery extends Query<FirstEventState> {
    constructor(readonly params: ExecuteParams<GetConnectionFirstEventRequest>) {
        super()
    }
}
