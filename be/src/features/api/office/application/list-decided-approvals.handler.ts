import { QueryHandler } from "@nestjs/cqrs"
import { OfficeThreadService } from "@modules/domain/office-command-candidates"
import type { ApprovalView } from "@modules/domain/office-command-candidates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListDecidedApprovalsQuery } from "./list-decided-approvals.query"

@QueryHandler(ListDecidedApprovalsQuery)
/** Answers the decided approvals from the office thread service. */
export class ListDecidedApprovalsHandler extends ICQRSHandler<ListDecidedApprovalsQuery, ReadonlyArray<ApprovalView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly thread: OfficeThreadService,
    ) {
        super(logger)
    }

    protected override process(query: ListDecidedApprovalsQuery): Promise<ReadonlyArray<ApprovalView>> {
        return this.thread.decidedApprovals(query.params.principal.id, query.params.request.workspaceId)
    }
}
