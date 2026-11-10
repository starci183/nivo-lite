import type { InboxLeadsQuery } from "@modules/domain/inbox-leads"

/** The lead list asked in the active workspace. */
export interface ListInboxLeadsRequest {
    /** The workspace selected by the transport. */
    readonly workspaceId: string
    /** The tab, the filters, the order and the most rows. */
    readonly query: InboxLeadsQuery
}
