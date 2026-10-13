/** The inbound dedupe key of a bank payment event: `bank:payment:<event id>`; the same event redelivered is one input. */
export const bankDedupeKey = (eventId: string): string => `bank:payment:${eventId.trim()}`
