/** The payment step of a workspace that is not paid yet. */
export const workspacePaymentPath = (workspaceId: string): string =>
    `/workspaces/new/payment?ws=${encodeURIComponent(workspaceId)}`

/** The plan, payments and renewal page of one workspace. */
export const workspaceBillingPath = (workspaceId: string): string =>
    `/workspaces/${encodeURIComponent(workspaceId)}/billing`
