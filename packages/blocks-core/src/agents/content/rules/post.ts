import { z, type ZodType } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"

/** The social channels a post is written for. */
export const CONTENT_CHANNELS: readonly ["facebook", "zalo", "tiktok", "instagram"] = [
    "facebook",
    "zalo",
    "tiktok",
    "instagram",
]

/** The longest post text, brief or note kept: the longest channel limit with room for the hashtags. */
export const POST_TEXT_MAX = 5_000

/** One social channel. */
export type ContentChannel = (typeof CONTENT_CHANNELS)[number]

/** Where a post stands: written by the agent (or a person), approved by a person, published on its channel. */
export const CONTENT_STATUSES: readonly ["draft", "approved", "published"] = ["draft", "approved", "published"]

/** One state of a post. */
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

/** What publishing a post answered: the channel's id of the post and its public address, when the channel gave them. */
export type PublishResult = {
    /** The channel's id of the post; null when it gave none. */
    readonly postId: string | null
    /** The public address of the post; null when none. */
    readonly url: string | null
}

/** The shape the entity keeps the publish result in. */
export const publishResultShape: ZodType<PublishResult> = z.object({
    postId: z.string().max(MAX_ID).nullable(),
    url: z.string().max(MAX_LINE).nullable(),
})

/** The channels as values of any type, so an unknown value is looked up without a cast. */
const CHANNEL_VALUES: ReadonlyArray<unknown> = CONTENT_CHANNELS

/** Whether a value is one of the channels. */
export const isContentChannel = (value: unknown): value is ContentChannel =>
    CHANNEL_VALUES.includes(value)

/** The wall-clock time of a post, `HH:MM`, or null when the text is no such time. */
export const wallTimeOf = (value: string): string | null => {
    const match = /^(\d{2}):(\d{2})$/u.exec(value.trim())
    if (match === null) return null
    const hour = Number(match[1])
    const minute = Number(match[2])
    return hour <= 23 && minute <= 59 ? `${match[1]}:${match[2]}` : null
}
