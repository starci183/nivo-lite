import type { SepayPayload } from "./billing.contracts"
import type { BankAccountOptions } from "./billing.options"
import { sameText } from "./channel-secret.policy"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { numberOf, textOf, textOrNull } from "./webhook-body.policy"
import type { JsonObject } from "./webhook-body.policy"

const APIKEY_HEADER = /^\s*Apikey\s+(.+?)\s*$/i

/** The key a sender presented as `Authorization: Apikey <key>`, or undefined when the header is missing or another scheme. */
export const presentedApiKey = (header: string | undefined): string | undefined =>
    header === undefined ? undefined : APIKEY_HEADER.exec(header)?.[1]

/** True when `header` is `Authorization: Apikey <key>` with exactly the configured key, compared in constant time. */
export const isValidApiKey = (header: string | undefined, expected: string | undefined): boolean => {
    if (!expected) return false
    const presented = presentedApiKey(header)
    return presented !== undefined && sameText(presented, expected)
}

/** SePay's VietQR image for one transfer: https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=... */
export const qrImageUrl = (account: BankAccountOptions, amount: number, orderCode: string): string => {
    const query = new URLSearchParams({
        acc: account.account,
        bank: account.bank,
        amount: String(amount),
        des: orderCode,
        template: "compact",
    })
    return `https://qr.sepay.vn/img?${query.toString()}`
}

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
