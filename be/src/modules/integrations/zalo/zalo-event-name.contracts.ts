/** The raw body of a Zalo webhook delivery as the door received it; undefined when the delivery carried none. */
export type ZaloRawBody = Buffer | string | undefined

/** The event name of a delivery, or null when the body names none of the shape of an event name. */
export type OptionalZaloEventName = string | null
