import type { BillingWorkspace } from "@modules/domain/billing"
import type { BillingWorkspaceRequest } from "../../application/billing-workspace.contracts"
import type { BillingWorkspaceType } from "./dto/billing-workspace.type"

/** Maps the GraphQL selector to the query request. */
export const toBillingWorkspaceRequest = (workspaceId: string): BillingWorkspaceRequest => ({ workspaceId })

/** Maps the domain answer to the GraphQL contract. */
export const toBillingWorkspaceType = (result: BillingWorkspace): BillingWorkspaceType => ({ ...result })
