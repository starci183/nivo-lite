/** A send started without a durable acknowledgement; receipt reconciliation is required before another send. */
export const CHAT_DELIVERY_UNKNOWN = "delivery_outcome_unknown"

/**
 * The key a run's honest holding line is stored under starts with this (`honest-line:<runId>`): the line promises a reply, it is not one,
 * so what the customer said before it is still unanswered.
 */
export const HOLDING_LINE_KEY_PREFIX = "honest-line:"

/** The channel ref a stored line keeps for its key. */
export const lineRefOf = (key: string): string => `line:${key}`
