/** What a channel says of one person on it: the display name and the picture link, each an empty text when the channel says nothing. */
export interface ChannelProfile {
    /** The display name, or an empty text. */
    readonly name: string
    /** The https address of the picture, or an empty text. */
    readonly picture: string
}

/** A channel profile, or null when the channel will not say (no token yet, a refusal, a person it does not know). */
export type OptionalChannelProfile = ChannelProfile | null

/**
 * A messaging provider's profile read (its API operation "get the profile of a person", level 1 / level 2 of providers rule 13): the
 * person by the channel's own id on one of the provider's accounts. It reads only: the caller keeps what it wants of the answer.
 */
export interface ChannelProfilePort {
    /** The provider key of the accounts it reads (`zalo_oa`). */
    readonly provider: string
    /** What the channel says of the person; null when it will not say. Never throws for a refusal of the channel. */
    profileOf(connectionId: string, personId: string): Promise<OptionalChannelProfile>
}
