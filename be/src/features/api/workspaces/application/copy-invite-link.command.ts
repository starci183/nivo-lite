import { Command } from "@nestjs/cqrs"
import type { InviteResult } from "@modules/domain/workspace-invites"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CopyInviteLinkRequest } from "./copy-invite-link.contracts"

/** Asks for a fresh link to a pending invitation, without emailing it. */
export class CopyInviteLinkCommand extends Command<InviteResult> {
    constructor(readonly params: ExecuteParams<CopyInviteLinkRequest>) {
        super()
    }
}
