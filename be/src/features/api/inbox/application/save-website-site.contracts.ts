import type { WebsiteSiteChange } from "@modules/domain/inbox-leads"

/** Changes the website intake of the active workspace. */
export interface SaveWebsiteSiteRequest {
    /** The workspace selected by the transport. */
    readonly workspaceId: string
    /** What changes; a field left out keeps its value. */
    readonly change: WebsiteSiteChange
}
