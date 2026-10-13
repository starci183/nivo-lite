import { Query } from "@nestjs/cqrs"
import type { BillingWorkspace } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BillingWorkspaceRequest } from "./billing-workspace.contracts"

/** Asks for billingWorkspace using the verified caller. */
export class BillingWorkspaceQuery extends Query<BillingWorkspace> {
    constructor(readonly params: ExecuteParams<BillingWorkspaceRequest>) {
        super()
    }
}
