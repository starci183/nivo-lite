import { Query } from "@nestjs/cqrs"
import type { DirectoryMember } from "@modules/domain/member-grants"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListApproversRequest } from "./list-approvers.contracts"

/** Asks for everyone of the workspace an approver group can name, with the rooms they sit in. */
export class ListApproversQuery extends Query<ReadonlyArray<DirectoryMember>> {
    constructor(readonly params: ExecuteParams<ListApproversRequest>) {
        super()
    }
}
