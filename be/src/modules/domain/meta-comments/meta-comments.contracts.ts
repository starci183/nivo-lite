/** A comment a Page received, as its private-reply window records it. */
export interface CommentNote {
    /** The connection of the Page. */
    readonly connectionId: string
    /** The comment id on the platform. */
    readonly commentId: string
    /** Facebook or Instagram. */
    readonly platform: string
    /** When the comment arrived, ISO 8601. */
    readonly at: string
}
