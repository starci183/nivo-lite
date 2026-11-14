/** The inbound dedupe key of an input with the channel's own event id: `<channel>:<kind>:<event id>`. */
export const eventDedupeKey = (channel: string, kind: string, eventId: string): string =>
    `${channel}:${kind}:${eventId.trim()}`
