import type { InstructionAccount } from "@modules/domain/provider-registry"
import type { OptionalAmountVnd } from "./sepay-payload.contracts"

/**
 * The QR image host, as SePay's current docs state it: base `https://vietqr.app/img` with `acc`, `bank`, `amount`, `des`, `template`.
 * https://docs.sepay.vn/tao-qr-code-vietqr-dong.html and https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code (both name this base).
 */
const SEPAY_QR_IMAGE = "https://vietqr.app/img"

/** One query pair, the value percent-encoded the way the docs' own examples write it (a space is `%20`). */
const pair = (name: string, value: string): string => `${name}=${encodeURIComponent(value)}`

/**
 * SePay's VietQR image for one transfer into `account`: https://vietqr.app/img?acc=...&bank=...&amount=...&des=...&template=compact.
 * A null amount leaves `amount` out so the payer types it (the docs: "leave it out"). Platform billing draws its own QR through this same builder.
 */
export const vietQrUrl = (account: InstructionAccount, amountVnd: OptionalAmountVnd, content: string): string => {
    const pairs = [pair("acc", account.accountNumber), pair("bank", account.bankCode)]
    if (amountVnd !== null) pairs.push(pair("amount", String(amountVnd)))
    pairs.push(pair("des", content), pair("template", "compact"))
    return `${SEPAY_QR_IMAGE}?${pairs.join("&")}`
}
