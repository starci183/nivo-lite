/** The inbound dedupe key of a bank payment event: `bank:payment:<event id>`; the same event redelivered is one input. */
export const bankDedupeKey = (eventId: string): string => `bank:payment:${eventId.trim()}`

/** The inbound dedupe key of an input with the channel's own event id: `<channel>:<kind>:<event id>`. */
export const eventDedupeKey = (channel: string, kind: string, eventId: string): string =>
    `${channel}:${kind}:${eventId.trim()}`
