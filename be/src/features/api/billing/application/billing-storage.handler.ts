import { QueryHandler } from "@nestjs/cqrs"
import { EntitlementsService } from "@modules/domain/billing"
import type { WorkspaceStorage } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BillingStorageQuery } from "./billing-storage.query"

@QueryHandler(BillingStorageQuery)
/** Answers the storage of a workspace; the capability proves the caller is one of its members. */
export class BillingStorageHandler extends ICQRSHandler<BillingStorageQuery, WorkspaceStorage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly entitlements: EntitlementsService,
    ) {
        super(logger)
    }

    protected override process(query: BillingStorageQuery): Promise<WorkspaceStorage> {
        return this.entitlements.storageOf(query.params.principal.id, query.params.request.workspaceId)
    }
}
