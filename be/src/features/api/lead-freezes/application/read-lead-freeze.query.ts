import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { OptionalLeadFreezeView, ReadLeadFreezeRequest } from "./lead-freeze.contracts"

/** Whether a lead, or the customer of a run, waits for the owner to handle a failed run. */
export class ReadLeadFreezeQuery extends Query<OptionalLeadFreezeView> {
    constructor(readonly params: ExecuteParams<ReadLeadFreezeRequest>) {
        super()
    }
}
