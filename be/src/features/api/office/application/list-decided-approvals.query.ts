import { Query } from "@nestjs/cqrs"
import type { ApprovalView } from "@modules/domain/office-command-candidates"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListDecidedApprovalsRequest } from "./list-decided-approvals.contracts"

/** Asks for the most recently decided executions. */
export class ListDecidedApprovalsQuery extends Query<ReadonlyArray<ApprovalView>> {
    constructor(readonly params: ExecuteParams<ListDecidedApprovalsRequest>) {
        super()
    }
}
