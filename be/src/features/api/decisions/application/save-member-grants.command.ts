import { Command } from "@nestjs/cqrs"
import type { MemberGrant } from "@modules/domain/member-grants"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveMemberGrantsRequest } from "./save-member-grants.contracts"

/** Asks to make the approval limits of one action exactly the ones named. */
export class SaveMemberGrantsCommand extends Command<ReadonlyArray<MemberGrant>> {
    constructor(readonly params: ExecuteParams<SaveMemberGrantsRequest>) {
        super()
    }
}
