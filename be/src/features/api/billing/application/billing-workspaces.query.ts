import { Query } from "@nestjs/cqrs"
import type { BillingWorkspace } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BillingWorkspacesRequest } from "./billing-workspaces.contracts"

/** Asks for billingWorkspaces using the verified caller. */
export class BillingWorkspacesQuery extends Query<ReadonlyArray<BillingWorkspace>> {
    constructor(readonly params: ExecuteParams<BillingWorkspacesRequest>) {
        super()
    }
}
