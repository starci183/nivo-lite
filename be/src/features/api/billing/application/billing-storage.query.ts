import { Query } from "@nestjs/cqrs"
import type { WorkspaceStorage } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BillingStorageRequest } from "./billing-storage.contracts"

/** Asks for the storage a workspace keeps, using the verified caller. */
export class BillingStorageQuery extends Query<WorkspaceStorage> {
    constructor(readonly params: ExecuteParams<BillingStorageRequest>) {
        super()
    }
}
