/** The payment step of a workspace that is not paid yet. */
export const workspacePaymentPath = (workspaceId: string): string =>
    `/workspaces/new/payment?ws=${encodeURIComponent(workspaceId)}`

/** The channels step of the first-run wizard of one workspace; `wizardQuery` opens a connection wizard on it. */
export const workspaceChannelsPath = (workspaceId: string, wizardQuery = ""): string =>
    `/workspaces/new/channels?ws=${encodeURIComponent(workspaceId)}${wizardQuery === "" ? "" : "&"}${wizardQuery}`

/** The handover step of the first-run wizard of one workspace. */
export const workspaceHandoverPath = (workspaceId: string): string =>
    `/workspaces/new/ai?ws=${encodeURIComponent(workspaceId)}`

/** The plan step of the first-run wizard of one workspace: pay for a plan or start on the free one. */
export const workspacePlanPath = (workspaceId: string): string =>
    `/workspaces/new/plan?ws=${encodeURIComponent(workspaceId)}`

/** The last step of the first-run wizard of one workspace. */
export const workspaceReadyPath = (workspaceId: string): string =>
    `/workspaces/new/done?ws=${encodeURIComponent(workspaceId)}`

/** A plan renewal payment requested for an existing workspace. */
export const workspaceRenewalPaymentPath = (workspaceId: string, orderId: string): string =>
    `/workspaces/new/payment?order=${encodeURIComponent(orderId)}&ws=${encodeURIComponent(workspaceId)}&return=billing`

/** The credits and plan view of the selected workspace. */
export const creditsPath = (): string => "/billing"

/** The plan change of the selected workspace: the plans side by side and the priced change. */
export const billingPlanPath = (): string => "/billing/plan"
