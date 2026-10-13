import { Query } from "@nestjs/cqrs"
import type { ApprovalView } from "@modules/domain/office-command-candidates"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListPendingApprovalsRequest } from "./list-pending-approvals.contracts"

/** Asks for the executions waiting for a human decision. */
export class ListPendingApprovalsQuery extends Query<ReadonlyArray<ApprovalView>> {
    constructor(readonly params: ExecuteParams<ListPendingApprovalsRequest>) {
        super()
    }
}
