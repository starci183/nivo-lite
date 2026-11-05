/** The channels a customer writes from; any other name is website chat. */
export const CHATBOT_CHANNELS: readonly ["telegram", "zalo", "facebook", "instagram", "website"] = [
    "telegram",
    "zalo",
    "facebook",
    "instagram",
    "website",
]

/** A channel a customer writes from. */
export type ChatbotChannel = (typeof CHATBOT_CHANNELS)[number]

/** The name of each channel; they are proper names, the same in both product languages. */
const CHANNEL_NAMES: Readonly<Record<ChatbotChannel, string>> = {
    telegram: "Telegram",
    zalo: "Zalo",
    facebook: "Facebook",
    instagram: "Instagram",
    website: "Website",
}

/** Unknown or internal channel names are website chat. */
export const channelOf = (channel: string): ChatbotChannel =>
    CHATBOT_CHANNELS.find((known) => known === channel) ?? "website"

/** The name of the channel a conversation runs on, as the customer pane writes it. */
export const channelNameOf = (channel: string): string => CHANNEL_NAMES[channelOf(channel)]
