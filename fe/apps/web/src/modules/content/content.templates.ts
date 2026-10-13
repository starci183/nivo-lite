import type { ChannelRule, ContentChannel } from "./types"

/** The channels a post can be written for, in display order, with their length and hashtag limits; a channel's name is the `content.channel_<key>` catalog entry. */
export const CHANNEL_RULES: ReadonlyArray<ChannelRule> = [
    { key: "facebook", short: "FB", max_chars: 1500, hashtags: { min: 0, max: 3 } },
    { key: "zalo", short: "Zalo", max_chars: 500, hashtags: { min: 0, max: 0 } },
    { key: "tiktok", short: "TikTok", max_chars: 300, hashtags: { min: 3, max: 6 } },
    { key: "instagram", short: "IG", max_chars: 1000, hashtags: { min: 5, max: 10 } },
]

/** The display name of a channel: its `content.channel_<key>` catalog entry, read through the content translator. */
export const channelLabel = (t: (key: string) => string, channel: ContentChannel): string => t(`channel_${channel}`)

/** Phrases that sound like a promised outcome (Vietnamese, written as escapes). */
export const CLAIM_PROMISES: ReadonlyArray<RegExp> = [
    /cam k\u1ebft/i,
    /\u0111\u1ea3m b\u1ea3o (?:k\u1ebft qu\u1ea3|hi\u1ec7u qu\u1ea3|kh\u1ecfi)/i,
    /ch\u1eafc ch\u1eafn (?:kh\u1ecfi|hi\u1ec7u qu\u1ea3|gi\u1ea3m|tr\u1eafng|\u0111\u1eb9p)/i,
    /100\s*%/i,
    /kh\u1ecfi h\u1eb3n|h\u1ebft h\u1eb3n|v\u0129nh vi\u1ec5n/i,
]

/** A discount or gift word followed by a figure; the figure is the first group (Vietnamese, written as escapes). */
export const CLAIM_FIGURE: RegExp =
    /(?:gi\u1ea3m|khuy\u1ebfn m\u00e3i|\u01b0u \u0111\u00e3i|t\u1eb7ng|sale)[^.\n]{0,24}?(\d{1,3}(?:[.,]\d{3})*\s*(?:%|k\b|\u0111\b|ngh\u00ecn|tri\u1ec7u|tr\b))/gi

/** Words that mark a line as talking about prices, promotions or events (Vietnamese, written as escapes). */
export const CLAIM_OFFER: RegExp =
    /\u01b0u \u0111\u00e3i|khuy\u1ebfn m\u00e3i|gi\u1ea3m|combo|g\u00f3i|t\u1eb7ng|mi\u1ec5n ph\u00ed|s\u1ef1 ki\u1ec7n|khai tr\u01b0\u01a1ng/i
