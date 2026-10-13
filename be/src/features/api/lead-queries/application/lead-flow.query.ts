import { Query } from "@nestjs/cqrs"
import type { LeadFlowView } from "@modules/domain/lead-views"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LeadFlowRequest } from "./lead-flow.contracts"

/** Reads a customer's journey through the record-owning capabilities. */
export class LeadFlowQuery extends Query<LeadFlowView> {
    constructor(readonly params: ExecuteParams<LeadFlowRequest>) {
        super()
    }
}
