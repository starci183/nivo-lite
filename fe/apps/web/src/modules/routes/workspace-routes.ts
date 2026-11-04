/** The payment step of a workspace that is not paid yet. */
export const workspacePaymentPath = (workspaceId: string): string =>
    `/workspaces/new/payment?ws=${encodeURIComponent(workspaceId)}`

/** A plan renewal payment requested for an existing workspace. */
export const workspaceRenewalPaymentPath = (workspaceId: string, orderId: string): string =>
    `/workspaces/new/payment?order=${encodeURIComponent(orderId)}&ws=${encodeURIComponent(workspaceId)}&return=billing`

/** The credits and plan view of the selected workspace. */
export const creditsPath = (): string => "/billing"
