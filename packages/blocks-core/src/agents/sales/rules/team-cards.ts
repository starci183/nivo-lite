import type { TeamAudience, TeamCardPost } from "@nivo-lite/agent-sdk/team-chat"
import { messageOf } from "../../../shared/messages/catalog"
import { orderAddressOf } from "../nodes/order-card.policy"
import type { OrderSummaryPayload, PaymentReceivedPayload } from "../../../shared/agent-message/sales-agent-message-kinds"
import { ORDER_HREF } from "../nodes/order-notice.href"
import { summaryLinesOf, type CatalogueImageRow } from "../nodes/order-notice.lines"
import {
    amountTextOf,
    noticeLinesOf,
    orderSummaryOf,
    orderTitleOf,
    paymentSummaryOf,
    type NoticeLocale,
} from "../nodes/order-notice.policy"

/** An order as a card to the team reads it from the record. */
export interface CardOrder {
    /** The order number. */
    readonly orderNo: string
    /** The total in VND, or null while a price is missing. */
    readonly amountVnd: number | null
    /** The items as the order record keeps them. */
    readonly items: unknown
    /** The delivery address and notes of the order; empty when none. */
    readonly note: string
}

/**
 * The order of a row of the order record as a card reads it, or null when the row has no order number: the total is the row's own figure
 * (null while a price is missing), the items as the record keeps them, the delivery line its address (or the note of an older order).
 */
export const cardOrderOf = (row: Readonly<Record<string, unknown>> | undefined): CardOrder | null =>
    typeof row?.orderNo === "string"
        ? {
              orderNo: row.orderNo,
              amountVnd: typeof row.amountVnd === "number" ? row.amountVnd : null,
              items: row.items,
              note: orderAddressOf(row),
          }
        : null

/**
 * The amounts of the bank credits that paid an order, oldest first, from the order's rows of the bank transaction record listed newest
 * first: only a credit that was matched counts as money received (a debit, or a credit still to review, does not).
 */
export const matchedCreditsOf = (rows: ReadonlyArray<Readonly<Record<string, unknown>>>): ReadonlyArray<number> =>
    rows
        .filter((row) => row.direction === "credit" && row.status === "matched" && typeof row.amountVnd === "number")
        .map((row) => Number(row.amountVnd))
        .toReversed()

/** A card to the team as the chat stores it: the heading, the one line where no card is drawn, the content of its kind and the record it opens. */
export interface TeamCard<P> {
    /** The registered kind of the content. */
    readonly kind: string
    /** What the message is for. */
    readonly intent: "notify"
    /** The heading. */
    readonly title: string
    /** The one line the chat shows where no card is drawn. */
    readonly summary: string
    /** The content, in the shape its kind declares. */
    readonly payload: P
    /** The record the message is about, with where it opens. */
    readonly work: TeamCardWork
}

/** The record a card to the team is about: its words and where it opens. */
export interface TeamCardWork {
    /** The record's words in the reader's language. */
    readonly label: string
    /** Where the record opens. */
    readonly href: string
}

const workOf = (locale: NoticeLocale): TeamCardWork => ({
    label: messageOf(locale, "orderNoticeOrder"),
    href: ORDER_HREF,
})

/**
 * The card of an order for the team, built from the order record alone: its number, its lines with the catalogue photo and the prices the
 * record holds, the total, the customer and where to deliver. Nothing on it comes from the one who asked for the card.
 */
export const teamOrderCardOf = (
    order: CardOrder,
    customer: string,
    catalogue: ReadonlyArray<CatalogueImageRow>,
    locale: NoticeLocale,
): TeamCard<OrderSummaryPayload> => ({
    kind: "order.summary",
    intent: "notify",
    title: orderTitleOf(order.orderNo, locale),
    summary: orderSummaryOf(
        {
            orderNo: order.orderNo,
            lines: noticeLinesOf(order.items),
            amountVnd: order.amountVnd,
            customer,
            address: order.note,
        },
        locale,
    ),
    payload: {
        orderNo: order.orderNo,
        lines: summaryLinesOf(order.items, catalogue, locale),
        amountText: order.amountVnd === null ? "" : amountTextOf(order.amountVnd, locale),
        customer,
        address: order.note,
    },
    work: workOf(locale),
})

/**
 * The card of the money that paid an order, built from the order record and the amounts of the bank credits that paid it (an order may
 * be paid in parts): the TOTAL received, each credit when there were several, the order's lines, the customer.
 */
export const teamPaymentCardOf = (
    order: CardOrder,
    creditsVnd: ReadonlyArray<number>,
    customer: string,
    catalogue: ReadonlyArray<CatalogueImageRow>,
    locale: NoticeLocale,
): TeamCard<PaymentReceivedPayload> => {
    const receivedVnd = creditsVnd.reduce((total, one) => total + one, 0)
    return {
        kind: "payment.received",
        intent: "notify",
        title: amountTextOf(receivedVnd, locale),
        summary: paymentSummaryOf(order.orderNo, receivedVnd, locale),
        payload: {
            orderNo: order.orderNo,
            amountText: amountTextOf(receivedVnd, locale),
            ...(creditsVnd.length > 1 ? { credits: creditsVnd.map((one) => amountTextOf(one, locale)) } : {}),
            lines: summaryLinesOf(order.items, catalogue, locale),
            customer,
        },
        work: workOf(locale),
    }
}

/**
 * The finished post of a card for the team post tool (`nivo.tool.team.message.post`): the card exactly as `teamOrderCardOf` /
 * `teamPaymentCardOf` built it, with who reads it. The engine checks `payload` against the schema of the kind this package registered and
 * stores it as it is, so what the chat shows is what the card builder gave.
 */
export const teamCardPostOf = <P extends object>(card: TeamCard<P>, audience?: TeamAudience): TeamCardPost => ({
    kind: card.kind,
    intent: card.intent,
    title: card.title,
    summary: card.summary,
    payload: card.payload,
    work: card.work,
    ...(audience === undefined ? {} : { audience }),
})
