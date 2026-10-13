import { QueryHandler } from "@nestjs/cqrs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ConnectionBoardEntry } from "@modules/domain/connection-grants"
import { ListConnectionsQuery } from "./list-connections.query"

@QueryHandler(ListConnectionsQuery)
/** Asks for every connection of the workspace with the agents that use each through the ConnectionGrantsService. */
export class ListConnectionsHandler extends ICQRSHandler<ListConnectionsQuery, ReadonlyArray<ConnectionBoardEntry>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly grants: ConnectionGrantsService,
    ) {
        super(logger)
    }

    protected override process(query: ListConnectionsQuery): Promise<ReadonlyArray<ConnectionBoardEntry>> {
        return this.grants.board({
            principalId: query.params.principal.id,
            workspaceId: query.params.request.workspaceId,
        })
    }
}
