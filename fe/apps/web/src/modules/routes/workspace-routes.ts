/** The payment step of a workspace that is not paid yet. */
export const workspacePaymentPath = (workspaceId: string): string =>
    `/workspaces/new/payment?ws=${encodeURIComponent(workspaceId)}`

/** The plan, payments and renewal page of one workspace. */
export const workspaceBillingPath = (workspaceId: string): string =>
    `/workspaces/${encodeURIComponent(workspaceId)}/billing`

/** A plan renewal payment requested for an existing workspace. */
export const workspaceRenewalPaymentPath = (workspaceId: string, orderId: string): string =>
    `/workspaces/new/payment?order=${encodeURIComponent(orderId)}&ws=${encodeURIComponent(workspaceId)}&return=billing`

/** The credits and plan view of the selected workspace. */
export const creditsPath = (): string => "/billing"
