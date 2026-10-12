import { QueryHandler } from "@nestjs/cqrs"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import type { PendingInvite } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListInvitesQuery } from "./list-invites.query"

@QueryHandler(ListInvitesQuery)
/** Answers the pending invitations from the invites service. */
export class ListInvitesHandler extends ICQRSHandler<ListInvitesQuery, ReadonlyArray<PendingInvite>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: WorkspaceInvitesService,
    ) {
        super(logger)
    }

    protected override process(query: ListInvitesQuery): Promise<ReadonlyArray<PendingInvite>> {
        return this.invites.listPending(query.params.principal.id, query.params.request.workspaceId)
    }
}
