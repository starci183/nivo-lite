import type { ConnectionRecord } from "@modules/domain/connections"

/** One signed delivery to the receiver of a webhook account: the JSON text that was signed and the headers, the signature among them. */
export interface WebhookSendRequest {
    /** The JSON text that was signed. */
    readonly body: string
    /** The headers, including the signature. */
    readonly headers: Readonly<Record<string, string>>
}

/** What a delivery answered: the receiver's status, or why none arrived (the shape of the delivery client's answer, so the verdicts read it alike). */
export interface WebhookSendResult {
    /** The HTTP status the receiver answered, null when none did. */
    readonly status: number | null
    /** Why no status arrived: no answer in time (the receiver may have got it) or never reached (it did not). */
    readonly failure: "timeout" | "unreachable" | null
    /** How long it took, in milliseconds. */
    readonly durationMs: number
}

/**
 * The outgoing side of a webhook account, the one port its two implementations answer (the live one posts to the receiver address the
 * account holds, the sandbox one answers from its catalogue): `WebhookSendRegistryService.portFor(account)` picks. A failure that
 * proves nothing was sent is a `WebhookConnectionsError` (`NoUrl`: the account holds no address; `UrlRefused`: the address cannot be a
 * delivery target); everything the receiver answered, or did not, is the result.
 */
export interface WebhookSendPort {
    /** The provider key. */
    readonly provider: "webhook"
    /** Posts one signed delivery to the receiver of the account. */
    post(connection: ConnectionRecord, request: WebhookSendRequest): Promise<WebhookSendResult>
}
