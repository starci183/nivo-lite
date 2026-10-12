import { Command } from "@nestjs/cqrs"
import type { AcceptedInvite } from "@modules/domain/workspace-invites"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AcceptInviteRequest } from "./accept-invite.contracts"

/** Asks to join the workspace an invitation names, as the signed-in caller. */
export class AcceptInviteCommand extends Command<AcceptedInvite> {
    constructor(readonly params: ExecuteParams<AcceptInviteRequest>) {
        super()
    }
}
