/** One signed event to deliver. */
export interface N8nDelivery {
    /** The delivery id: the receiver's dedupe key, the same on every retry. */
    readonly deliveryId: string
    /** The workspace the event belongs to; it selects the signing key. */
    readonly workspaceId: string
    /** The event name, a dotted identifier. */
    readonly event: string
    /** Full webhook urls. */
    readonly urls: ReadonlyArray<string>
    /** Webhook paths under the configured base, for example `nivo/email-daily-report`. */
    readonly paths: ReadonlyArray<string>
    /** The JSON data of the event. */
    readonly data: object
    /** The instant of the event in epoch milliseconds: it is the signed timestamp. */
    readonly occurredAtMs: number
}

/** What one target answered. */
export interface N8nTargetResult {
    /** The origin of the target url; never the path, which can carry a secret. */
    readonly origin: string
    /** True when the target accepted the event. */
    readonly ok: boolean
    /** The HTTP status, absent when the request never got one. */
    readonly status: number | undefined
    /** True when the failure is worth another try. */
    readonly transient: boolean
}
