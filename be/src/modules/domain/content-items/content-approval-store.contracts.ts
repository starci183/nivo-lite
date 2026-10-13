import type { ContentItem } from "./content-editor.contracts"

/** A person's edited first-channel draft, or null to retain the stored text. */
export type ContentApprovalDraft = string | null

/** The draft version shown on the approval card; submission fails if an editor changed it concurrently. */
export type ContentSubmissionSnapshot = Pick<ContentItem, "variants" | "channels">

/** Whether every selected channel has a publication mark. */
export interface ContentPublishedResult {
    /** The content item. */
    readonly id: string
    /** True after all of its channels have publication marks. */
    readonly allDone: boolean
}
