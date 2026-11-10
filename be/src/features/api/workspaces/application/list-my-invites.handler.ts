import { QueryHandler } from "@nestjs/cqrs"
import { MyInvitesService } from "@modules/domain/workspace-invites"
import type { InviteForMe } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListMyInvitesQuery } from "./list-my-invites.query"

@QueryHandler(ListMyInvitesQuery)
/** Answers the caller's pending invitations from the invites service. */
export class ListMyInvitesHandler extends ICQRSHandler<ListMyInvitesQuery, ReadonlyArray<InviteForMe>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: MyInvitesService,
    ) {
        super(logger)
    }

    protected override process(query: ListMyInvitesQuery): Promise<ReadonlyArray<InviteForMe>> {
        return this.invites.listMine(query.params.principal)
    }
}
