import { messageOf } from "../../messages/catalog"
import { orderLinesOf, type OrderLine } from "./order-lines.policy"

/** The languages an order notice is written in. */
export type NoticeLocale = "vi" | "en"

/** What the notice of a new order is made of. */
export interface OrderNoticeFacts {
    /** The order number, as people read it. */
    readonly orderNo: string
    /** The lines of the order. */
    readonly lines: ReadonlyArray<OrderLine>
    /** The total in VND, or null while a price is missing. */
    readonly amountVnd: number | null
    /** The name the customer gave, or empty. */
    readonly customer: string
    /** Where to deliver, or empty. */
    readonly address: string
}

const SEPARATOR = " \u00b7 "

/** An amount of VND with its thousands separated by dots and the currency after it. */
export const amountTextOf = (amountVnd: number, locale: NoticeLocale): string =>
    `${amountVnd.toLocaleString("de-DE")} ${messageOf(locale, "orderNoticeCurrency")}`

/** The items of an order in a few words: `1 x tea, 2 x cake`. */
const linesTextOf = (lines: ReadonlyArray<OrderLine>): string =>
    lines.map((line) => `${String(line.qty)} x ${line.name}`).join(", ")

/** The heading of the notice of a new order. */
export const orderTitleOf = (orderNo: string, locale: NoticeLocale): string =>
    `${messageOf(locale, "orderNoticeTitle")} ${orderNo}`

/** The one line of a new order: number, items, amount, customer, delivery; a part that is not known is left out. */
export const orderSummaryOf = (facts: OrderNoticeFacts, locale: NoticeLocale): string => {
    return [
        orderTitleOf(facts.orderNo, locale),
        linesTextOf(facts.lines),
        facts.amountVnd === null ? "" : amountTextOf(facts.amountVnd, locale),
        facts.customer === "" ? "" : `${messageOf(locale, "orderNoticeCustomer")} ${facts.customer}`,
        facts.address === "" ? "" : `${messageOf(locale, "orderNoticeDeliver")} ${facts.address}`,
    ]
        .filter((part) => part !== "")
        .join(SEPARATOR)
}

/** The one line of a payment that settled an order: `Received 2.000 VND for DH-1`. */
export const paymentSummaryOf = (orderNo: string, amountVnd: number, locale: NoticeLocale): string =>
    [
        messageOf(locale, "orderNoticeReceived"),
        amountTextOf(amountVnd, locale),
        messageOf(locale, "orderNoticeFor"),
        orderNo,
    ].join(" ")

/** The lines of an order as the record keeps them. */
export const noticeLinesOf = (items: unknown): ReadonlyArray<OrderLine> => orderLinesOf(items)
