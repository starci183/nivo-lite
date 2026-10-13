import { Query } from "@nestjs/cqrs"
import type { LeadWait } from "@modules/domain/promo"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LeadWaitRequest } from "./lead-wait.contracts"

/** Requests leadWait for a workspace member. */
export class LeadWaitQuery extends Query<LeadWait> {
    constructor(readonly params: ExecuteParams<LeadWaitRequest>) {
        super()
    }
}
