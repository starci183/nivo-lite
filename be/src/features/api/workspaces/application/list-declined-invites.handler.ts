import { QueryHandler } from "@nestjs/cqrs"
import { MyInvitesService } from "@modules/domain/workspace-invites"
import type { DeclinedInvite } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListDeclinedInvitesQuery } from "./list-declined-invites.query"

@QueryHandler(ListDeclinedInvitesQuery)
/** Answers the declined invitations of the workspace from the invites service. */
export class ListDeclinedInvitesHandler extends ICQRSHandler<ListDeclinedInvitesQuery, ReadonlyArray<DeclinedInvite>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: MyInvitesService,
    ) {
        super(logger)
    }

    protected override process(query: ListDeclinedInvitesQuery): Promise<ReadonlyArray<DeclinedInvite>> {
        return this.invites.listDeclined(query.params.principal.id, query.params.request.workspaceId)
    }
}
