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

/** One comment of a Page. */
export interface PageComment {
    /** The connection of the Page. */
    readonly connectionId: string
    /** The comment id on the platform. */
    readonly commentId: string
}

/** Where the private reply of one comment stands. */
export interface CommentReplyState {
    /** When the comment was made (ms since the epoch), or null when it is not known. */
    readonly commentAt: number | null
    /** Its one private reply was already taken. */
    readonly replied: boolean
}
