/** One work item of the dashboard lists, with the lead's name folded in; read from public.work_items. */
export interface DashboardItemRow {
    /** The work item. */
    id: string
    /** The action key. */
    action: string
    /** The lead, or null. */
    lead_id: string | null
    /** When the item was raised (waiting) or finished (done), ISO 8601 as the query writes it. */
    at: string
    /** The proposal or result summary, or null. */
    summary: string | null
    /** The customer name, or null. */
    customer: string | null
    /** The href the finished work recorded, or null. */
    result_href: string | null
    /** How many rows match before the limit. */
    total: string
}
