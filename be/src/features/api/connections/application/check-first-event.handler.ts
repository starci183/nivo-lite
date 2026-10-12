import { QueryHandler } from "@nestjs/cqrs"
import { ConnectionsService } from "@modules/domain/connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CheckFirstEventQuery } from "./check-first-event.query"
import type { CheckFirstEventResult } from "./check-first-event.contracts"

@QueryHandler(CheckFirstEventQuery)
/** Answers whether the first event has reached a connection (manager). */
export class CheckFirstEventHandler extends ICQRSHandler<CheckFirstEventQuery, CheckFirstEventResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connectionsService: ConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: CheckFirstEventQuery): Promise<CheckFirstEventResult> {
        const { request } = query.params
        return this.connectionsService.firstEvent(
            { principalId: query.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}
