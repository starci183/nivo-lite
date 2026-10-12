import { QueryHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResumeConnectionQuery } from "./resume-connection.query"
import type { ResumeConnectionResult } from "./resume-connection.contracts"

@QueryHandler(ResumeConnectionQuery)
/** Reopens an unfinished bank or payment feed connection. */
export class ResumeConnectionHandler extends ICQRSHandler<ResumeConnectionQuery, ResumeConnectionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: ResumeConnectionQuery): Promise<ResumeConnectionResult> {
        const { request } = query.params
        return this.channelConnectionsService.resumeConnection(
            { principalId: query.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}
