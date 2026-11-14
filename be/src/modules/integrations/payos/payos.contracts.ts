import type { HttpRequest } from "@modules/platform/http"

/** The HTTP methods the payOS operations use. */
export type HttpMethod = HttpRequest["method"]

/** The three keys of one payOS payment channel, as the connection's sealed credential holds them (`clientId`, `apiKey`, `checksumKey`). */
export interface PayosCredential {
    /** Sent as `x-client-id`. */
    readonly clientId: string
    /** Sent as `x-api-key`. */
    readonly apiKey: string
    /** The key of the HMAC-SHA256 signature; never sent. */
    readonly checksumKey: string
}

/** A JSON value payOS answered or is sent, kept as it came. */
export interface PayosData {
    /** Any member. */
    readonly [member: string]: unknown
}

/** What one call of an operation sends besides the keys: the path parameters and the JSON body. */
export interface PayosCall {
    /** The values of the path's `{param}`s. */
    readonly path?: Readonly<Record<string, string>>
    /** The JSON body of a POST (for the create operation: the members to sign and send; the client adds `signature`). */
    readonly body?: PayosData
}

/** What payOS answered to a create: the members of `data` the adapter relies on. */
export interface PayosCreated {
    /** `paymentLinkId`. */
    readonly paymentLinkId: string
    /** `orderCode`. */
    readonly orderCode: number
    /** `checkoutUrl`. */
    readonly checkoutUrl: string
    /** `qrCode` (a string; the docs describe no more), or null when absent. */
    readonly qrCode: string | null
    /** `amount`. */
    readonly amount: number
    /** `description`, or an empty text when absent. */
    readonly description: string
    /** `status`. */
    readonly status: string
}

/** What payOS answered to a get or a cancel: the members of `data` the adapter relies on. */
export interface PayosInfo {
    /** `id`: the payment link id. */
    readonly id: string
    /** `orderCode`. */
    readonly orderCode: number
    /** `amount`. */
    readonly amount: number
    /** `amountPaid`, or null when absent. */
    readonly amountPaid: number | null
    /** `amountRemaining`, or null when absent. */
    readonly amountRemaining: number | null
    /** `status`. */
    readonly status: string
    /** `createdAt` as printed, or null. */
    readonly createdAt: string | null
    /** `canceledAt` as printed (cancel only), or null. */
    readonly canceledAt: string | null
    /** `cancellationReason` (cancel only), or null. */
    readonly cancellationReason: string | null
}
