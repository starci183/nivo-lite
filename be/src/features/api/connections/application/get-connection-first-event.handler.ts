import { QueryHandler } from "@nestjs/cqrs"
import { ChannelFrontDoorService } from "@modules/domain/agent-instances"
import { ConnectionsService, type FirstEventState } from "@modules/domain/connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetConnectionFirstEventQuery } from "./get-connection-first-event.query"

@QueryHandler(GetConnectionFirstEventQuery)
/**
 * Asks whether the first event of a connection has arrived through the ConnectionsService. A Zalo OA stays pending until its first event, so
 * the moment the connection is seen connected with its first event kept, the channel's front door is made sure of again (idempotent): the
 * rights on the now working account join the binding written at connect.
 */
export class GetConnectionFirstEventHandler extends ICQRSHandler<GetConnectionFirstEventQuery, FirstEventState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connections: ConnectionsService,
        private readonly frontDoor: ChannelFrontDoorService,
    ) {
        super(logger)
    }

    protected override async process(query: GetConnectionFirstEventQuery): Promise<FirstEventState> {
        const actor = { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId }
        const state = await this.connections.firstEvent(actor, query.params.request.connectionId)
        if (state.status === "connected" && state.firstEvent !== null) {
            await this.frontDoor.ensureForConnection(actor, query.params.request.connectionId)
        }
        return state
    }
}
