import { QueryHandler } from "@nestjs/cqrs"
import { ApproverDirectoryService, type ApproverDirectoryEntry } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ListApproversQuery } from "./list-approvers.query"

@QueryHandler(ListApproversQuery)
/** The people an approver group of a graph could name: the capability answers none (owner and manager only may ask). */
export class ListApproversHandler extends ICQRSHandler<ListApproversQuery, ReadonlyArray<ApproverDirectoryEntry>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly directory: ApproverDirectoryService,
    ) {
        super(logger)
    }

    protected override process(query: ListApproversQuery): Promise<ReadonlyArray<ApproverDirectoryEntry>> {
        return this.directory.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
