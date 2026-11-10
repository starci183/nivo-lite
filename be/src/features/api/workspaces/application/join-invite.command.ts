import { Command } from "@nestjs/cqrs"
import type { AcceptedInvite } from "@modules/domain/workspace-invites"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { JoinInviteRequest } from "./join-invite.contracts"

/** Asks to accept, by its id, an invitation addressed to the caller. */
export class JoinInviteCommand extends Command<AcceptedInvite> {
    constructor(readonly params: ExecuteParams<JoinInviteRequest>) {
        super()
    }
}
