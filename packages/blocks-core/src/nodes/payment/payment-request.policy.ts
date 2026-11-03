import { REQUEST_WORDS } from "./payment-request.messages"
import type { RequestLocale } from "./payment-request.messages"

/** What the `payment.instruction` tool answers: the account to pay into and the QR link of the transfer. */
export interface PaymentInstruction {
    /** The bank name to show, or null. */
    readonly bankName: string | null
    /** The short bank code. */
    readonly bankCode: string
    /** The full account number, digits only. */
    readonly accountNumber: string
    /** The account holder, or null. */
    readonly accountHolder: string | null
    /** The QR image link of the transfer, drawn by the provider tool. */
    readonly qrUrl: string
    /** The provider the account comes from. */
    readonly provider: string
}

/** A line of a recorded order as the order data port reads it. */
export interface OrderLine {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
}

/** The transfer content of an order number: letters and digits only, upper case (`DH-20261105-0001` becomes `DH202611050001`). */
export const transferContentOf = (orderNo: string): string => orderNo.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

/** The items of an order in a few words: `2 x tea, 1 x cake`. */
export const itemsTextOf = (lines: ReadonlyArray<OrderLine>): string =>
    lines.map((line) => `${String(line.qty)} x ${line.name}`).join(", ")

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value), template)

/** The message that asks the customer to pay: the amount, the items, the account, the transfer content and the QR link. */
export const paymentMessageOf = (
    instruction: PaymentInstruction,
    order: { readonly amountVnd: number; readonly lines: ReadonlyArray<OrderLine> },
    content: string,
    locale: RequestLocale,
): string => {
    const words = REQUEST_WORDS[locale]
    const amount = `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(order.amountVnd)} ${words.currency}`
    const items = itemsTextOf(order.lines)
    return [
        fill(words.intro, { items: items === "" ? "—" : items, amount }),
        fill(words.bank, { bank: instruction.bankName ?? instruction.bankCode }),
        fill(words.account, { account: instruction.accountNumber }),
        ...(instruction.accountHolder === null ? [] : [fill(words.holder, { holder: instruction.accountHolder })]),
        fill(words.content, { content }),
        fill(words.qr, { url: instruction.qrUrl }),
        words.outro,
    ].join("\n")
}

/** The title of the work item that tells the owner the payment request could not go out. */
export const noAccountTitleOf = (orderNo: string, locale: RequestLocale): string =>
    fill(REQUEST_WORDS[locale].noAccount, { order: orderNo })
