/** The channels the new-lead form offers, in display order. */
export const CHANNEL_KEYS = [
    "channelZalo",
    "channelWebsiteChat",
    "channelWebsiteForm",
    "channelPhone",
    "channelEmail",
    "channelReferral",
] as const

/** One channel the form offers. */
type ChannelKey = (typeof CHANNEL_KEYS)[number]

/** The labels of every channel in one language. */
export type ChannelLabels = Readonly<Record<ChannelKey, string>>

const normalized = (text: string): string => text.trim().toLowerCase().normalize("NFC")

/**
 * The label of a stored channel text in the reader language: a text that equals the label of any catalog language names its
 * channel, so a lead captured in one language reads right in the other; free text shows as typed.
 */
export const channelLabelOf = (
    channel: string,
    languages: ReadonlyArray<ChannelLabels>,
    reader: ChannelLabels,
): string => {
    const wanted = normalized(channel)
    const key = CHANNEL_KEYS.find((candidate) => languages.some((labels) => normalized(labels[candidate]) === wanted))
    return key === undefined ? channel : reader[key]
}
