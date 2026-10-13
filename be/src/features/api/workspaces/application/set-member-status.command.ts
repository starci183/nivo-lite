import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetMemberStatusRequest } from "./set-member-status.contracts"

/** Asks to enable or disable a member of the caller's workspace. */
export class SetMemberStatusCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetMemberStatusRequest>) {
        super()
    }
}
