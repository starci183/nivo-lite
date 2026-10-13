import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { FoundingMemberRequest } from "./founding-member.contracts"

/** Requests foundingMember for a workspace member. */
export class FoundingMemberQuery extends Query<boolean> {
    constructor(readonly params: ExecuteParams<FoundingMemberRequest>) {
        super()
    }
}
