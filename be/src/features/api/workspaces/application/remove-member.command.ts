import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveMemberRequest } from "./remove-member.contracts"

/** Asks to remove a member from the caller's workspace. */
export class RemoveMemberCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RemoveMemberRequest>) {
        super()
    }
}
