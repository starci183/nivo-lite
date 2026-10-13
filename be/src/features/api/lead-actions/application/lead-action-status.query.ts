import { Query } from "@nestjs/cqrs"
import type { LeadActionStatus } from "@modules/domain/lead-actions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LeadActionStatusRequest } from "./lead-action-status.contracts"

/** Reads the persisted status of one workspace-scoped lead action. */
export class LeadActionStatusQuery extends Query<LeadActionStatus> {
    constructor(readonly params: ExecuteParams<LeadActionStatusRequest>) {
        super()
    }
}
