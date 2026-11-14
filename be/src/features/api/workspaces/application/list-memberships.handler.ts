import { QueryHandler } from "@nestjs/cqrs"
import { LobbyMembershipsService, type LobbyMembership } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ListMembershipsQuery } from "./list-memberships.query"

@QueryHandler(ListMembershipsQuery)
/** Answers the caller's memberships, with the lobby facts of each, from the lobby read. */
export class ListMembershipsHandler extends ICQRSHandler<ListMembershipsQuery, ReadonlyArray<LobbyMembership>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly lobby: LobbyMembershipsService,
    ) {
        super(logger)
    }

    protected override process(query: ListMembershipsQuery): Promise<ReadonlyArray<LobbyMembership>> {
        return this.lobby.memberships(query.params.principal.id)
    }
}
