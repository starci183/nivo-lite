import type { WebsiteSubmission } from "@modules/domain/inbox-leads"

/** One form a visitor filled in on the hosted page of a shop website. */
export interface SubmitWebsiteLeadRequest {
    /** The public key in the address of the hosted form. */
    readonly siteKey: string
    /** What the visitor sent. */
    readonly submission: WebsiteSubmission
}
