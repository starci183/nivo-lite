import { vietQrUrl } from "@modules/domain/channel-connections"
import type { SepayPayload } from "./billing.contracts"
import type { BankAccountOptions } from "./billing.options"
import { sameText } from "./channel-secret.policy"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { numberOf, textOf, textOrNull } from "./webhook-body.policy"
import type { JsonObject } from "./webhook-body.policy"

const APIKEY_HEADER = /^Apikey\s/iu
const LINE_BREAK = /[\r\n\u2028\u2029]/u

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
export const isValidApiKey = (header: string | undefined, expected: string | undefined): boolean => {
    if (!expected) return false
    const presented = presentedApiKey(header)
    return presented !== undefined && sameText(presented, expected)
}

/** SePay's VietQR image for one transfer: https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=... */
export const qrImageUrl = (account: BankAccountOptions, amount: number, orderCode: string): string =>
    vietQrUrl({ accountNumber: account.account, bankCode: account.bank }, amount, orderCode)

/** The fields of a SePay delivery that NIVO reads; the whole body is kept as the stored payload. A delivery without a safe integer id is invalid. */
export const sepayPayloadOf = (body: JsonObject): SepayPayload => {
    const id = numberOf(body.id)
    if (id === undefined || !Number.isSafeInteger(id)) throw new BillingError({ code: BillingErrorCode.WebhookInvalid })
    return {
        id,
        gateway: textOf(body.gateway),
        transferType: textOf(body.transferType),
        // A delivery without an amount counts as 0 (the SQL settlement then reports it underpaid); an unreadable amount stays undefined.
        transferAmount:
            body.transferAmount === undefined || body.transferAmount === null ? 0 : numberOf(body.transferAmount),
        content: textOrNull(body.content),
        code: textOrNull(body.code),
        description: textOrNull(body.description),
    }
}

/**
 * True for SePay's test ping: a delivery with no safe integer id that moves no money (no `in`/`out` transfer of a positive amount).
 * It is acknowledged and traced as a ping, never settled; a delivery with money but no id stays invalid, so a real credit is not lost.
 */
export const isSepayPing = (body: JsonObject): boolean => {
    const id = numberOf(body.id)
    if (id !== undefined && Number.isSafeInteger(id)) return false
    const amount = numberOf(body.transferAmount)
    const moves = (body.transferType === "in" || body.transferType === "out") && amount !== undefined && amount > 0
    return !moves
}
