import { Command } from "@nestjs/cqrs"
import type { InviteResult } from "@modules/domain/workspace-invites"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateInviteRequest } from "./create-invite.contracts"

/** Asks to invite a person into the caller's workspace. */
export class CreateInviteCommand extends Command<InviteResult> {
    constructor(readonly params: ExecuteParams<CreateInviteRequest>) {
        super()
    }
}
