/** One line of a workspace's append-only evidence log. */
export interface EventEntry {
    /** The workspace the line belongs to. */
    readonly workspaceId: string
    /** What happened, a dotted name such as `member.invited`. */
    readonly kind: string
    /** Who did it: a member's display name or an agent's name. */
    readonly actor: string
    /** One short sentence for the history view. */
    readonly summary: string
    /** The customer the line is about, when there is one. */
    readonly leadId?: string | null
    /** The work item the line belongs to, when there is one. */
    readonly workItemId?: string | null
    /** The evidence behind the line, when there is some. */
    readonly evidence?: string | null
}

/** One line of a customer's history as a prompt reads it. */
export interface EventLine {
    /** The short sentence. */
    readonly summary: string
    /** The evidence behind it, or null. */
    readonly evidence: string | null
}

/** Filters and bounds a workspace's evidence-log read. */
export interface EventListFilter {
    /** Restricts the history to one lead, when provided. */
    readonly leadId?: string
    /** Restricts the history to one event kind, when provided. */
    readonly kind?: string
    /** Restricts the history to these work items; an empty list selects none. */
    readonly workItemIds?: ReadonlyArray<string>
    /** The maximum number of lines the caller needs. */
    readonly limit: number
    /** Reads the oldest lines first instead of the most recent lines. */
    readonly oldestFirst?: boolean
}

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
    /** The creation time as ISO 8601 text. */
    readonly created_at: string
    /** The work item the action belongs to, when there is one. */
    readonly work_item_id: string | null
}
