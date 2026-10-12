import type { ResponsibilityListing, ResponsibilityRecord } from "../decisions.contracts"

/** public.responsibilities as the queries answer it: timestamps arrive as ISO text and CHECK columns narrowed. */
export type ResponsibilityRow = ResponsibilityRecord

/** A responsibility with the name of its customer. */
export type ResponsibilityListingRow = ResponsibilityListing

/** The name of a customer. */
export interface LeadNameRow {
    /** The customer's name. */
    contact_name: string
}

/** The id and name of an agent. */
export interface AgentNameRow {
    /** The agent id. */
    id: string
    /** The agent name. */
    name: string
}
