import type { GetPlatformHealthRequest, GetPlatformHealthResult } from "../../application/get-platform-health.contracts"
import type { AdminHealthType } from "./dto/admin-health.type"

/** Maps nothing to the application request. */
export const toAdminHealthRequest = (): GetPlatformHealthRequest => ({})

/** Maps the application result to the GraphQL type. */
export const toAdminHealthType = (result: GetPlatformHealthResult): AdminHealthType => ({
    signups: result.signups.map((entry) => ({ ...entry })),
    transfers: result.transfers.map((entry) => ({ ...entry })),
    transferCounts: result.transferCounts.map((entry) => ({ ...entry })),
    billingEvents: result.billingEvents.map((entry) => ({ ...entry })),
    errors: result.errors.map((entry) => ({ ...entry })),
    errorScopes: result.errorScopes.map((entry) => ({ ...entry })),
    audits: result.audits.map((entry) => ({ ...entry })),
    workspaceNames: result.workspaceNames.map((entry) => ({ ...entry })),
})
