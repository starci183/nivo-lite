import { messageOf } from "../messages/catalog"
import type { MessageKey } from "../messages/catalog"
import { itemsTextOf, orderLinesOf } from "../nodes/payment/payment-request.policy"
import { amountTextOf } from "../nodes/sales/order-notice.policy"
import type { NoticeLocale } from "../nodes/sales/order-notice.policy"

/** Where a customer pays an order, as the workspace's bank feed and its provider answer it. */
export interface PaymentQrAccount {
    /** The name of the bank; empty when only its code is known. */
    readonly bankName: string
    /** The code of the bank. */
    readonly bankCode: string
    /** The account number to pay into. */
    readonly accountNumber: string
    /** The name the account is held under; empty when unknown. */
    readonly accountHolder: string
    /** The address of the QR code that pays the order. */
    readonly qrUrl: string
}

/** The order a payment message is about, from its record. */
export interface PaymentQrOrder {
    /** The total due, VND. */
    readonly amountVnd: number
    /** The items as the order record keeps them. */
    readonly items: unknown
}

/** A line of the catalog with its `{{name}}` places filled. */
const filled = (locale: NoticeLocale, key: MessageKey, values: Readonly<Record<string, string>>): string =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value), messageOf(locale, key))

/**
 * The message that asks a customer to pay a confirmed order: the items and the total of the order record, the bank, the account, the
 * holder, the transfer content to type and the QR link. Every number and name on it comes from the order and the workspace's bank feed;
 * the one who asked for the message gives the order's id alone.
 */
export const paymentQrTextOf = (
    account: PaymentQrAccount,
    order: PaymentQrOrder,
    transferContent: string,
    locale: NoticeLocale,
): string => {
    const items = itemsTextOf(orderLinesOf(order.items))
    return [
        filled(locale, "paymentQrIntro", {
            items: items === "" ? "—" : items,
            amount: amountTextOf(order.amountVnd, locale),
        }),
        filled(locale, "paymentQrBank", { bank: account.bankName === "" ? account.bankCode : account.bankName }),
        filled(locale, "paymentQrAccount", { account: account.accountNumber }),
        ...(account.accountHolder === "" ? [] : [filled(locale, "paymentQrHolder", { holder: account.accountHolder })]),
        filled(locale, "paymentQrContent", { content: transferContent }),
        filled(locale, "paymentQrLink", { url: account.qrUrl }),
        messageOf(locale, "paymentQrOutro"),
    ].join("\n")
}
