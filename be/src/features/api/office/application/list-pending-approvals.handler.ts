import { QueryHandler } from "@nestjs/cqrs"
import { OfficeThreadService } from "@modules/domain/office-command-candidates"
import type { ApprovalView } from "@modules/domain/office-command-candidates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListPendingApprovalsQuery } from "./list-pending-approvals.query"

@QueryHandler(ListPendingApprovalsQuery)
/** Answers the waiting approvals from the office thread service. */
export class ListPendingApprovalsHandler extends ICQRSHandler<ListPendingApprovalsQuery, ReadonlyArray<ApprovalView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly thread: OfficeThreadService,
    ) {
        super(logger)
    }

    protected override process(query: ListPendingApprovalsQuery): Promise<ReadonlyArray<ApprovalView>> {
        return this.thread.pendingApprovals(query.params.principal.id, query.params.request.workspaceId)
    }
}
