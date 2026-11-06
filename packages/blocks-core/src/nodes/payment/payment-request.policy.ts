import type { PaymentInstruction } from "../../vocabulary"
import { REQUEST_WORDS } from "./payment-request.messages"
import type { RequestLocale } from "./payment-request.messages"

/** A line of a recorded order as the order data port reads it. */
export interface OrderLine {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
}

/** An order that is asked to be paid: its amount and its lines. */
export interface PayableLines {
    /** The amount due in VND. */
    readonly amountVnd: number
    /** The lines of the order. */
    readonly lines: ReadonlyArray<OrderLine>
}

/** The transfer content of an order number: letters and digits only, upper case (`DH-20261105-0001` becomes `DH202611050001`). */
export const transferContentOf = (orderNo: string): string => orderNo.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

/** The items of an order in a few words: `2 x tea, 1 x cake`. */
export const itemsTextOf = (lines: ReadonlyArray<OrderLine>): string =>
    lines.map((line) => `${String(line.qty)} x ${line.name}`).join(", ")

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value), template)

/** The amount of an order in the language asked, with the currency. */
const amountTextOf = (amountVnd: number, locale: RequestLocale): string =>
    `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(amountVnd)} ${REQUEST_WORDS[locale].currency}`

/** The message that tells the customer the order is recorded when the payment details cannot be given yet: the items and the amount, and that the shop will send the details. */
export const orderHeldMessageOf = (order: PayableLines, locale: RequestLocale): string => {
    const items = itemsTextOf(order.lines)
    return fill(REQUEST_WORDS[locale].held, {
        items: items === "" ? "—" : items,
        amount: amountTextOf(order.amountVnd, locale),
    })
}

/** The message that asks the customer to pay: the amount, the items, the account, the transfer content and the QR link. */
export const paymentMessageOf = (
    instruction: PaymentInstruction,
    order: PayableLines,
    content: string,
    locale: RequestLocale,
): string => {
    const words = REQUEST_WORDS[locale]
    const amount = amountTextOf(order.amountVnd, locale)
    const items = itemsTextOf(order.lines)
    return [
        fill(words.intro, { items: items === "" ? "—" : items, amount }),
        fill(words.bank, { bank: instruction.bankName === "" ? instruction.bankCode : instruction.bankName }),
        fill(words.account, { account: instruction.accountNumber }),
        ...(instruction.accountHolder === "" ? [] : [fill(words.holder, { holder: instruction.accountHolder })]),
        fill(words.content, { content }),
        fill(words.qr, { url: instruction.qrUrl }),
        words.outro,
    ].join("\n")
}

/** The title of the work item that tells the owner the payment request could not go out. */
export const noAccountTitleOf = (orderNo: string, locale: RequestLocale): string =>
    fill(REQUEST_WORDS[locale].noAccount, { order: orderNo })
