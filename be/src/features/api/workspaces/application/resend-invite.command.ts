import { Command } from "@nestjs/cqrs"
import type { InviteResult } from "@modules/domain/workspace-invites"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ResendInviteRequest } from "./resend-invite.contracts"

/** Asks to email a pending invitation again with a new link. */
export class ResendInviteCommand extends Command<InviteResult> {
    constructor(readonly params: ExecuteParams<ResendInviteRequest>) {
        super()
    }
}
