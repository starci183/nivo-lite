import type { OptionalQrAmount, VietQrAccount } from "./channel-connections.contracts"

const SEPAY_QR_IMAGE = "https://qr.sepay.vn/img"

/**
 * SePay's VietQR image for one transfer into `account`: https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=...&template=compact.
 * A null amount leaves `amount` out so the payer types it. Platform billing draws its own QR through this same builder.
 */
export const vietQrUrl = (account: VietQrAccount, amountVnd: OptionalQrAmount, content: string): string => {
    const query = new URLSearchParams({ acc: account.accountNumber, bank: account.bankCode })
    if (amountVnd !== null) query.set("amount", String(amountVnd))
    query.set("des", content)
    query.set("template", "compact")
    return `${SEPAY_QR_IMAGE}?${query.toString()}`
}
