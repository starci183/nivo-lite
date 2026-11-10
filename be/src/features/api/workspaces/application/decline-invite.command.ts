import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeclineInviteRequest } from "./decline-invite.contracts"

/** Asks to decline an invitation addressed to the caller. */
export class DeclineInviteCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DeclineInviteRequest>) {
        super()
    }
}
