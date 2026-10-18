/** The order channels other than email. */
const OTHER_CHANNELS: ReadonlySet<string> = new Set(["zalo", "phone"])

/** The channel a typed value names: Zalo or phone when it says so, otherwise email. */
export const channelOf = (channel: string): string => (OTHER_CHANNELS.has(channel) ? channel : "email")
