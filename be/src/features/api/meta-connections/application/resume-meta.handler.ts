import { QueryHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResumeMetaQuery } from "./resume-meta.query"
import type { ResumeMetaResult } from "./resume-meta.contracts"

@QueryHandler(ResumeMetaQuery)
/** Reopens an unfinished Meta connection. */
export class ResumeMetaHandler extends ICQRSHandler<ResumeMetaQuery, ResumeMetaResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly metaConnectionsService: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: ResumeMetaQuery): Promise<ResumeMetaResult> {
        const { request } = query.params
        return this.metaConnectionsService.resume(
            { principalId: query.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}
