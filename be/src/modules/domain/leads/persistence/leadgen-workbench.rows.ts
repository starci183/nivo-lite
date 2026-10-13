import type { WorkItem } from "@modules/domain/decisions"

/** Lead attributes used by the Lead Gen workbench. */
export interface LeadGenLeadRow {
    /** Identity of the stored record. */
    readonly id: string
    /** Customer display name stored on the lead. */
    readonly contact_name: string
    /** Customer company name. */
    readonly company: string
    /** Capture channel label. */
    readonly channel: string
    /** The prospect need captured by the flow. */
    readonly need: string
    /** Current sales stage. */
    readonly stage: string
    /** Agent instance that captured or owns this record. */
    readonly installation_id: string | null
    /** Creation instant, ISO 8601. */
    readonly created_at: string
}

/** The existing work items that attribute, score and hand off captured leads. */
export type LeadGenWorkItemRow = Pick<
    WorkItem,
    | "id"
    | "department"
    | "action"
    | "lead_id"
    | "installation_id"
    | "status"
    | "proposal"
    | "created_at"
    | "completed_at"
>

/** A customer's conversation linked to a lead. */
export interface LeadGenConversationRow {
    /** Identity of the stored record. */
    readonly id: string
    /** The captured prospect linked to this conversation. */
    readonly lead_id: string | null
}

/** One chronological message used to measure replies. */
export interface LeadGenMessageRow {
    /** Customer conversation linked to this captured prospect. */
    readonly conversation_id: string
    /** Message author role. */
    readonly role: string
    /** Stored message text. */
    readonly body: string
    /** Creation instant, ISO 8601. */
    readonly created_at: string
}

/** Rows required to reproduce the Lead Gen workbench. */
export interface LeadGenWorkbenchRow {
    /** Clock instant used for reporting windows. */
    readonly nowMs: number
    /** Optional Lead Gen agent instance that limits this workbench. */
    readonly installationId: string | null
    /** The captured prospects included in this workbench. */
    readonly leads: ReadonlyArray<LeadGenLeadRow>
    /** Existing capture, scoring, reply and handoff work items. */
    readonly items: ReadonlyArray<LeadGenWorkItemRow>
    /** Customer conversations attached to captured prospects. */
    readonly conversations: ReadonlyArray<LeadGenConversationRow>
    /** Chronological customer conversation messages. */
    readonly messages: ReadonlyArray<LeadGenMessageRow>
    /** Checks whether any customer name marks a test run. */
    readonly isTestRun: (...names: ReadonlyArray<string | null | undefined>) => boolean
}
