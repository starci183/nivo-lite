/** One post as the content automations read it. */
export interface DueItem {
    /** The post. */
    readonly id: string
    /** Its title. */
    readonly title: string
    /** Its status: idea, draft, waiting_approval, approved, published or skipped. */
    readonly status: string
    /** The channels it goes to. */
    readonly channels: ReadonlyArray<string>
    /** When it is due, as an ISO instant. */
    readonly scheduledAt: string | null
    /** Its content theme. */
    readonly pillarId: string | null
}

/** The idea of a post about an offer. */
export interface OfferIdea {
    /** The workspace. */
    readonly workspaceId: string
    /** The title of the post. */
    readonly title: string
    /** What the post is about. */
    readonly brief: string
    /** The content theme, or null. */
    readonly pillarId: string | null
    /** The channels it goes to. */
    readonly channels: ReadonlyArray<string>
    /** The evidence lines as JSON text. */
    readonly evidence: string
}
