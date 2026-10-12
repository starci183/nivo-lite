import { QueryHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResumeZaloQuery } from "./resume-zalo.query"
import type { ResumeZaloResult } from "./resume-zalo.contracts"

@QueryHandler(ResumeZaloQuery)
/** Reopens an unfinished Zalo OA connection. */
export class ResumeZaloHandler extends ICQRSHandler<ResumeZaloQuery, ResumeZaloResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: ResumeZaloQuery): Promise<ResumeZaloResult> {
        const { request } = query.params
        return this.channelConnectionsService.resumeZalo(
            { principalId: query.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}
