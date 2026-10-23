import { createHmac } from "node:crypto"
import { sameText } from "./channel-secret.policy"
import { isJsonObject, textOf } from "./webhook-body.policy"
import type { JsonObject } from "./webhook-body.policy"

/** The body payOS posts: a code, a success flag, the payment `data` and the `signature` over it. */
export interface PayosBody {
    /** The result code; "00" is a paid order. */
    readonly code?: string | undefined
    /** The success flag; false is never booked. */
    readonly success?: boolean | undefined
    /** The payment data that the signature covers. */
    readonly data?: Readonly<Record<string, unknown>> | null
    /** The signature of the data under the checksum key. */
    readonly signature?: string | undefined
}

/** The result of reading a payOS delivery after it was proven. */
export type PayosReading =
    | { readonly kind: "credit"; readonly amount: number; readonly content: string; readonly eventId: string }
    | { readonly kind: "ignored"; readonly reason: "sample" | "not_paid" | "no_amount" }

/** payOS's own webhook confirmation sends a sample order with this code; it is acknowledged and never booked. */
const SAMPLE_ORDER_CODE = 123

const text = (value: unknown): string => {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value)
    return JSON.stringify(value)
}

/** HMAC-SHA256 (hex) with the channel's checksum key over the `data` fields sorted by key as `key=value` joined by `&`. */
export const payosSignature = (data: Readonly<Record<string, unknown>>, checksumKey: string): string =>
    createHmac("sha256", checksumKey)
        .update(
            Object.keys(data)
                .sort((left, right) => (left < right ? -1 : Number(left > right)))
                .map((name) => `${name}=${text(data[name])}`)
                .join("&"),
        )
        .digest("hex")

/** True when the delivery's `signature` equals the signature of its `data` under the checksum key, in constant time. */
export const isPayosAuthentic = (body: PayosBody, checksumKey: string): boolean => {
    if (!checksumKey || !body.signature || !body.data) return false
    return sameText(body.signature, payosSignature(body.data, checksumKey))
}

/** True for payOS's confirmation ping (the sample order), which may not be signed with the key yet. */
export const isPayosSample = (data: Readonly<Record<string, unknown>>): boolean =>
    Number(data.orderCode) === SAMPLE_ORDER_CODE

/** Reads a proven delivery: a paid order with an amount and a reference is a credit, anything else is ignored. */
export const readPayosDelivery = (body: PayosBody): PayosReading => {
    const data = body.data ?? {}
    if (isPayosSample(data)) return { kind: "ignored", reason: "sample" }
    if (body.success === false || body.code !== "00") return { kind: "ignored", reason: "not_paid" }
    const amount = Number(data.amount ?? 0)
    const reference = text(data.reference) || text(data.orderCode)
    if (!Number.isFinite(amount) || amount <= 0 || !reference) return { kind: "ignored", reason: "no_amount" }
    return { kind: "credit", amount, content: text(data.description).trim(), eventId: `payos:${reference}` }
}

/** The fields of a parsed payOS delivery the proof and the reading use; a field of the wrong type counts as absent. */
export const payosBodyOf = (body: JsonObject): PayosBody => ({
    code: textOf(body.code),
    success: typeof body.success === "boolean" ? body.success : undefined,
    data: isJsonObject(body.data) ? body.data : null,
    signature: textOf(body.signature),
})
