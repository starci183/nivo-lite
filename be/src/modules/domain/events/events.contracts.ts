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
    /** The lead the line is about, when it is about one. */
    readonly leadId?: string | null
    /** The evidence behind the line, when the person wrote some. */
    readonly evidence?: string | null
}
