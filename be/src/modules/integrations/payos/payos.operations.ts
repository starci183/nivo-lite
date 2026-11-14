import type { HttpMethod } from "./payos.contracts"

/**
 * THE payOS OPERATIONS NIVO CALLS, each from payOS's public documentation (read 2026-11-13, no live call made):
 * - the API reference of every operation below (method, path, request and response members, sample errors): https://payos.vn/docs/api/
 * - the signature rule (HMAC-SHA256 hex under the channel's checksum key over `key=value` pairs sorted by key, joined with `&`; a documented
 *   test vector): https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/
 * - return URL parameters and the status words PAID, PENDING, PROCESSING, CANCELLED: https://payos.vn/docs/du-lieu-tra-ve/return-url
 * - the payment webhook: https://payos.vn/docs/du-lieu-tra-ve/webhook
 * Base: `https://api-merchant.payos.vn`. Auth: headers `x-client-id` and `x-api-key` (the API reference's security scheme).
 *
 * NOT in the documentation read (so not built): the range or uniqueness rule of `orderCode`, a general maximum of `description`, the numeric
 * codes of the errors (the reference gives sample messages, no codes), how to verify the signature the answers carry, and the status words
 * beyond the four above.
 */
export interface PayosOperation {
    /** The operation's NIVO name. */
    readonly api: `nivo.api.payos.${string}`
    /** The HTTP method. */
    readonly method: HttpMethod
    /** The path below the base, `{param}` for a path parameter. */
    readonly path: string
}

/** The operations NIVO calls, by their stable names. */
export interface PayosOperations {
    /** "Tao link thanh toan". */
    readonly createLink: PayosOperation
    /** "Lay thong tin link thanh toan". */
    readonly getLink: PayosOperation
    /** "Huy link thanh toan". */
    readonly cancelLink: PayosOperation
}

/** The operations, by a stable name (the adapter writes `PAYOS_OPS.createLink`, never the path). */
export const PAYOS_OPS: PayosOperations = {
    /**
     * "Tao link thanh toan": body `orderCode` (integer, required), `amount` (integer, required), `description` (string, required; a limit
     * of 9 characters is stated for bank accounts not linked through payOS), `cancelUrl` and `returnUrl` (URI, required), `expiredAt`
     * (Unix timestamp, Int32), `signature` (required: HMAC_SHA256 over `amount`, `cancelUrl`, `description`, `orderCode`, `returnUrl`),
     * and optional `buyer*`, `items`, `invoice`. Response `{ code: "00", desc, data: { bin, accountNumber, accountName, amount,
     * description, orderCode, currency, paymentLinkId, status: "PENDING", checkoutUrl, qrCode }, signature }`.
     */
    createLink: { api: "nivo.api.payos.post-v2-payment-requests", method: "POST", path: "/v2/payment-requests" },
    /**
     * "Lay thong tin link thanh toan": path `id` is the order code OR the payment link id. Response `data`: `id`, `orderCode`, `amount`,
     * `amountPaid`, `amountRemaining`, `status`, `createdAt`, `transactions`.
     */
    getLink: { api: "nivo.api.payos.get-v2-payment-requests-id", method: "GET", path: "/v2/payment-requests/{id}" },
    /**
     * "Huy link thanh toan": path `id` as above, body `cancellationReason` (string, optional). Response `data`: as get plus
     * `canceledAt`, `cancellationReason`; `status` is "CANCELLED".
     */
    cancelLink: {
        api: "nivo.api.payos.post-v2-payment-requests-id-cancel",
        method: "POST",
        path: "/v2/payment-requests/{id}/cancel",
    },
}

/** The operation names. */
export type PayosOperationName = keyof PayosOperations
