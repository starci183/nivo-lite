/** The private-reply row of one comment. */
export interface MetaCommentRow {
    /** When the comment was made. */
    readonly comment_at: Date | string | null
    /** When its one private reply was claimed. */
    readonly private_replied_at: Date | string | null
}

/** The comment a claim took. */
export interface ClaimedCommentRow {
    /** The comment. */
    readonly comment_id: string
}
