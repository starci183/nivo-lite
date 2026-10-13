/** An evidence-log line selected for a workspace history view. */
export interface EventRecordRow {
    /** The evidence line. */
    readonly id: string
    /** The lead the line describes, when there is one. */
    readonly lead_id: string | null
    /** The event's dotted kind. */
    readonly kind: string
    /** The person or agent that performed the action. */
    readonly actor: string
    /** The short description of the action. */
    readonly summary: string
    /** The evidence behind the action, when present. */
    readonly evidence: string | null
    /** The creation time selected as ISO 8601 text. */
    readonly created_at: string
    /** The work item the action belongs to, when there is one. */
    readonly work_item_id: string | null
}
