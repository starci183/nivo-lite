import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ResendWorkspaceInviteRequest, ResendWorkspaceInviteResult } from "./resend-workspace-invite.contracts"

/** Reissues a pending invitation of a workspace and sends the email again. */
export class ResendWorkspaceInviteCommand extends Command<ResendWorkspaceInviteResult> {
    constructor(readonly params: ExecuteParams<ResendWorkspaceInviteRequest>) {
        super()
    }
}
