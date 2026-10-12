import { Query } from "@nestjs/cqrs"
import type { InvitePreview } from "@modules/domain/workspace-invites"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PreviewInviteRequest } from "./preview-invite.contracts"

/** Asks what an invitation link offers before it is accepted. */
export class PreviewInviteQuery extends Query<InvitePreview> {
    constructor(readonly params: ExecuteParams<PreviewInviteRequest>) {
        super()
    }
}
