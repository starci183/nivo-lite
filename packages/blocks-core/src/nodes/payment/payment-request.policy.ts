import { REQUEST_WORDS } from "./payment-request.messages"
import type { RequestLocale } from "./payment-request.messages"

/** The bank account a customer pays into, as the payment-account data port reads it. */
export interface PaymentAccount {
    /** The feed the account comes from. */
    readonly provider: string
    /** The short bank code as VietQR lists it. */
    readonly bankCode: string
    /** The bank name to show, or null. */
    readonly bankName: string | null
    /** The full account number, digits only. */
    readonly accountNumber: string
    /** The account holder, or null. */
    readonly accountHolder: string | null
}

/** A line of a recorded order as the order data port reads it. */
export interface OrderLine {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
}

/** The only feed whose account a payment request names. */
export const PAYMENT_PROVIDER = "sepay"

const SEPAY_QR_IMAGE = "https://qr.sepay.vn/img"

/** The transfer content of an order number: letters and digits only, upper case (`DH-20261105-0001` becomes `DH202611050001`). */
export const transferContentOf = (orderNo: string): string => orderNo.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

/** SePay VietQR image of one transfer into the account: the account, the bank, the amount and the transfer content. */
export const vietQrUrl = (account: PaymentAccount, amountVnd: number, content: string): string => {
    const query = new URLSearchParams({ acc: account.accountNumber, bank: account.bankCode })
    query.set("amount", String(amountVnd))
    query.set("des", content)
    query.set("template", "compact")
    return `${SEPAY_QR_IMAGE}?${query.toString()}`
}

/** True for an account a payment request may name: a SePay feed. */
export const isPayableAccount = (account: PaymentAccount | undefined): account is PaymentAccount =>
    account !== undefined && account.provider === PAYMENT_PROVIDER

/** The items of an order in a few words: `2 x tea, 1 x cake`. */
export const itemsTextOf = (lines: ReadonlyArray<OrderLine>): string =>
    lines.map((line) => `${String(line.qty)} x ${line.name}`).join(", ")

/** Everything the customer is told to pay one order. */
export interface PaymentRequestFacts {
    /** The transfer content to type. */
    readonly content: string
    /** The VietQR image link. */
    readonly qrUrl: string
    /** The message text, in the customer language. */
    readonly message: string
}

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value), template)

/** The payment request of an order: the transfer content, the VietQR link and the message that carries them. */
export const paymentRequestOf = (
    account: PaymentAccount,
    order: { readonly orderNo: string; readonly amountVnd: number; readonly lines: ReadonlyArray<OrderLine> },
    locale: RequestLocale,
): PaymentRequestFacts => {
    const words = REQUEST_WORDS[locale]
    const content = transferContentOf(order.orderNo)
    const qrUrl = vietQrUrl(account, order.amountVnd, content)
    const amount = `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(order.amountVnd)} ${words.currency}`
    const items = itemsTextOf(order.lines)
    const message = [
        fill(words.intro, { items: items === "" ? "—" : items, amount }),
        fill(words.bank, { bank: account.bankName ?? account.bankCode }),
        fill(words.account, { account: account.accountNumber }),
        ...(account.accountHolder === null ? [] : [fill(words.holder, { holder: account.accountHolder })]),
        fill(words.content, { content }),
        fill(words.qr, { url: qrUrl }),
        words.outro,
    ].join("\n")
    return { content, qrUrl, message }
}

/** The title of the work item that tells the owner the payment request could not go out. */
export const noAccountTitleOf = (orderNo: string, locale: RequestLocale): string =>
    fill(REQUEST_WORDS[locale].noAccount, { order: orderNo })
