import type { BillingWorkspace } from "@modules/domain/billing"
import type { BillingWorkspaceType } from "./dto/billing-workspace.type"

/** Maps the domain answer to the GraphQL contract. */
export const toBillingWorkspacesType = (result: ReadonlyArray<BillingWorkspace>): ReadonlyArray<BillingWorkspaceType> =>
    result
