import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RevokeInviteRequest } from "./revoke-invite.contracts"

/** Asks to revoke a pending invitation. */
export class RevokeInviteCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RevokeInviteRequest>) {
        super()
    }
}
