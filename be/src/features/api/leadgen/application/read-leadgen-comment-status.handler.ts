import { QueryHandler } from "@nestjs/cqrs"
import { LeadGenCommentService } from "./leadgen-comment.service"
import type { LeadGenCommentStatus } from "./leadgen-comment.contracts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadLeadGenCommentStatusQuery } from "./read-leadgen-comment-status.query"

@QueryHandler(ReadLeadGenCommentStatusQuery)
/** Answers only the selected workspace's public-comment decision status. */
export class ReadLeadGenCommentStatusHandler extends ICQRSHandler<ReadLeadGenCommentStatusQuery, LeadGenCommentStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly comments: LeadGenCommentService,
    ) {
        super(logger)
    }

    protected override process(query: ReadLeadGenCommentStatusQuery): Promise<LeadGenCommentStatus> {
        return this.comments.status(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.workItemId,
        )
    }
}
