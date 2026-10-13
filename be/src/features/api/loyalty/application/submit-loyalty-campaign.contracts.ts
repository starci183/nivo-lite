import type { Locale } from "@modules/platform/i18n"

/** What submitting a drafted loyalty campaign takes. */
export interface SubmitLoyaltyCampaignRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The finished draft. */
    readonly id: string
    /** The language of the summary the owner reads. */
    readonly locale: Locale
}

/** What submitting a drafted loyalty campaign answers. */
export interface SubmitLoyaltyCampaignResult {
    /** The campaign. */
    readonly campaignId: string
    /** The work item that records the decision. */
    readonly workItemId: string
    /** The work item status: `waiting_decision` when a person must decide. */
    readonly status: string
}
