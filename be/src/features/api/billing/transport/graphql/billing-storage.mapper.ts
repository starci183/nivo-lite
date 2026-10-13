import type { WorkspaceStorage } from "@modules/domain/billing"
import type { BillingStorageRequest } from "../../application/billing-storage.contracts"
import type { BillingStorageType } from "./dto/billing-storage.type"

/** Maps the selected workspace to the query request. */
export const toBillingStorageRequest = (workspaceId: string): BillingStorageRequest => ({ workspaceId })

/** Maps the domain answer to the GraphQL contract. */
export const toBillingStorageType = (result: WorkspaceStorage): BillingStorageType => ({ ...result })
