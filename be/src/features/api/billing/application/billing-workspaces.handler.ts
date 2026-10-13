import { QueryHandler } from "@nestjs/cqrs"
import { BillingService } from "@modules/domain/billing"
import type { BillingWorkspace } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BillingWorkspacesQuery } from "./billing-workspaces.query"

@QueryHandler(BillingWorkspacesQuery)
/** Answers billingWorkspaces through its domain capability. */
export class BillingWorkspacesHandler extends ICQRSHandler<BillingWorkspacesQuery, ReadonlyArray<BillingWorkspace>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override async process(query: BillingWorkspacesQuery): Promise<ReadonlyArray<BillingWorkspace>> {
        return this.billing.workspaces(query.params.principal.id)
    }
}
