import { safeEqual } from "@modules/domain/connection-secrets"
import { fieldNumberOf, fieldTextOf, fieldTextOrNullOf } from "@modules/platform/primitives"
import type { OptionalApiKey, OptionalSepayPayload } from "./sepay-payload.contracts"

const APIKEY_HEADER = /^Apikey\s/iu
const LINE_BREAK = /[\r\n\u2028\u2029]/u

/** A parsed webhook body whose values are not yet trusted. */
export interface SepayBody {
    readonly [field: string]: unknown
}

/** The key a sender presented as `Authorization: Apikey <key>`, or undefined when the header is missing or another scheme. */
export const presentedApiKey = (header: string | undefined): string | undefined => {
    if (header === undefined) return undefined
    const value = header.trimStart()
    if (!APIKEY_HEADER.test(value)) return undefined
    const rest = value.slice(7)
    const key = rest.trim()
    if (key !== "") return LINE_BREAK.test(key) ? undefined : key
    return [...rest].reverse().find((character) => !LINE_BREAK.test(character))
}

/** True when `header` is `Authorization: Apikey <key>` with exactly the configured key, compared in constant time. */
export const isValidApiKey = (header: OptionalApiKey, expected: OptionalApiKey): boolean => {
    if (!expected) return false
    const presented = presentedApiKey(header)
    return presented !== undefined && safeEqual(presented, expected)
}

/**
 * The fields of a SePay delivery that NIVO reads; the whole body is kept as the stored payload. A delivery without a safe integer id
 * is undefined: the caller refuses it as invalid.
 */
export const readSepayPayload = (body: SepayBody): OptionalSepayPayload => {
    const id = fieldNumberOf(body.id)
    if (id === undefined || !Number.isSafeInteger(id)) return undefined
    return {
        id,
        gateway: fieldTextOf(body.gateway),
        transferType: fieldTextOf(body.transferType),
        // A delivery without an amount counts as 0 (the SQL settlement then reports it underpaid); an unreadable amount stays undefined.
        transferAmount:
            body.transferAmount === undefined || body.transferAmount === null ? 0 : fieldNumberOf(body.transferAmount),
        content: fieldTextOrNullOf(body.content),
        code: fieldTextOrNullOf(body.code),
        description: fieldTextOrNullOf(body.description),
    }
}

/**
 * True for the SePay test ping: a delivery with no safe integer id that moves no money (no `in`/`out` transfer of a positive amount).
 * It is acknowledged and traced as a ping, never settled; a delivery with money but no id stays invalid, so a real credit is not lost.
 */
export const isSepayPing = (body: SepayBody): boolean => {
    const id = fieldNumberOf(body.id)
    if (id !== undefined && Number.isSafeInteger(id)) return false
    const amount = fieldNumberOf(body.transferAmount)
    const moves = (body.transferType === "in" || body.transferType === "out") && amount !== undefined && amount > 0
    return !moves
}
