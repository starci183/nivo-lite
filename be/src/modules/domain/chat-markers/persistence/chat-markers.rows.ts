/** Result of `be_access.chat_target_member`, the shared target admission predicate. */
export interface ChatTargetRow {
    /** True only for an active member and existing scoped target. */
    readonly chat_target_member: boolean
}

/** One reader's profile picture from the avatar function. */
export interface ChatReaderAvatarRow {
    /** The account id. */
    readonly id: string
    /** The uploaded profile picture, else the provider picture. */
    readonly avatar_url: string | null
}
