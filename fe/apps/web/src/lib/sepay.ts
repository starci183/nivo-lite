/**
 * The bank account customers pay into and SePay's VietQR image URL. Pure (no database); the webhook doors, order codes and the
 * payload shape live in the back end now (be/src/features/webhooks/sepay).
 */

/** The bank account customers pay into. */
export type BankAccount = { readonly account: string; readonly bank: string; readonly holder: string }

/** The bank account customers pay into (env; placeholders until the owner connects SePay). */
export const bankAccount = (): BankAccount => ({
    account: process.env.SEPAY_BANK_ACCOUNT ?? "",
    bank: process.env.SEPAY_BANK_CODE ?? "",
    holder: process.env.SEPAY_ACCOUNT_NAME ?? "",
})

/** SePay's VietQR image for an account: https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=... */
export const qrUrlFor = (bank: Pick<BankAccount, "account" | "bank">, amount: number, orderCode: string): string => {
    const q = new URLSearchParams({
        acc: bank.account,
        bank: bank.bank,
        amount: String(amount),
        des: orderCode,
        template: "compact",
    })
    return `https://qr.sepay.vn/img?${q.toString()}`
}

/** The VietQR image of an order into the configured account. */
export const qrImageUrl = (amount: number, orderCode: string): string => qrUrlFor(bankAccount(), amount, orderCode)
