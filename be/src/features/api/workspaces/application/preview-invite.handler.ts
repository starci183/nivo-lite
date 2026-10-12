import { QueryHandler } from "@nestjs/cqrs"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import type { InvitePreview } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PreviewInviteQuery } from "./preview-invite.query"

@QueryHandler(PreviewInviteQuery)
/** Answers the preview from the invites service. */
export class PreviewInviteHandler extends ICQRSHandler<PreviewInviteQuery, InvitePreview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: WorkspaceInvitesService,
    ) {
        super(logger)
    }

    protected override process(query: PreviewInviteQuery): Promise<InvitePreview> {
        return this.invites.preview(query.params.request.token)
    }
}
