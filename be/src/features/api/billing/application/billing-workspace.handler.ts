import { QueryHandler } from "@nestjs/cqrs"
import { BillingService } from "@modules/domain/billing"
import type { BillingWorkspace } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BillingWorkspaceQuery } from "./billing-workspace.query"

@QueryHandler(BillingWorkspaceQuery)
/** Answers billingWorkspace through its domain capability. */
export class BillingWorkspaceHandler extends ICQRSHandler<BillingWorkspaceQuery, BillingWorkspace> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override async process(query: BillingWorkspaceQuery): Promise<BillingWorkspace> {
        return this.billing.workspace(query.params.principal.id, query.params.request.workspaceId)
    }
}
