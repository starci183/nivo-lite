import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApproverDirectoryEntry } from "@modules/domain/agent-pages"
import type { ListApproversRequest } from "./list-approvers.contracts"

/** Asks for everyone of the workspace an approver group can name, with the rooms they sit in. */
export class ListApproversQuery extends Query<ReadonlyArray<ApproverDirectoryEntry>> {
    constructor(readonly params: ExecuteParams<ListApproversRequest>) {
        super()
    }
}
