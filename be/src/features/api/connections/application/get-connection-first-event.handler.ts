import { QueryHandler } from "@nestjs/cqrs"
import { ConnectionsService } from "@modules/domain/connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { FirstEventState } from "@modules/domain/connections"
import { GetConnectionFirstEventQuery } from "./get-connection-first-event.query"

@QueryHandler(GetConnectionFirstEventQuery)
/** Asks whether the first event of a connection has arrived through the ConnectionsService. */
export class GetConnectionFirstEventHandler extends ICQRSHandler<GetConnectionFirstEventQuery, FirstEventState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connections: ConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: GetConnectionFirstEventQuery): Promise<FirstEventState> {
        return this.connections.firstEvent(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
