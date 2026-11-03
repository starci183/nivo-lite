import { readSepayPayload, vietQrUrl } from "@modules/domain/sepay-provider"
import type { SepayPayload } from "@modules/domain/sepay-provider"
import type { BankAccountOptions } from "./billing.options"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import type { JsonObject } from "./webhook-body.policy"

/** The VietQR image for one transfer of NIVO's own billing: https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=... */
export const qrImageUrl = (account: BankAccountOptions, amount: number, orderCode: string): string =>
    vietQrUrl({ accountNumber: account.account, bankCode: account.bank }, amount, orderCode)

/** The fields of a delivery to NIVO's own billing door that NIVO reads; a delivery without a safe integer id is invalid. */
export const sepayPayloadOf = (body: JsonObject): SepayPayload => {
    const payload = readSepayPayload(body)
    if (payload === undefined) throw new BillingError({ code: BillingErrorCode.WebhookInvalid })
    return payload
}
