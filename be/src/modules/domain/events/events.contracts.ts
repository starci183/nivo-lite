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
    /** The raw text that backs the line, when there is some. */
    readonly evidence?: string | null
}
