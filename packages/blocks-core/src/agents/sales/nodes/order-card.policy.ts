import type { LineOrder } from "../../../shared/customer-chat/message-line"
import { nameKey } from "./order/order.policy"
import { summaryLinesOf, type CatalogueImageRow } from "./order-notice.lines"
import { amountTextOf, type NoticeLocale } from "./order-notice.policy"

/** What the order card of a customer message is made of. */
export interface OrderCardFacts {
    /** The number the customer is told. */
    readonly orderNo: string
    /** The total in VND, or null while a price is missing. */
    readonly amountVnd: number | null
    /** The items as the order record keeps them. */
    readonly items: unknown
    /** Where to deliver, or empty while it is not known. */
    readonly address: string
    /** Whether the order was paid when the message was sent. */
    readonly paid: boolean
}

/**
 * Where an order row says it is delivered: its `deliveryAddress`, else (an order recorded before it had that field) its `note`, which then
 * held the address; empty when neither is text.
 */
export const orderAddressOf = (row: Readonly<Record<string, unknown>>): string => {
    if (typeof row.deliveryAddress === "string" && row.deliveryAddress !== "") {
        return row.deliveryAddress
    }
    return typeof row.note === "string" ? row.note : ""
}

/**
 * The order a message to the customer is about, as the thread draws it: the items with the photo of the catalogue item of the same name
 * (a sprout while it has none), the total in words, the delivery line and whether it was paid. A snapshot, so the thread shows what the customer got even if the order changes later.
 */
export const orderCardOf = (
    facts: OrderCardFacts,
    catalogue: ReadonlyArray<CatalogueImageRow>,
    locale: NoticeLocale,
): LineOrder => ({
    orderNo: facts.orderNo,
    lines: summaryLinesOf(facts.items, catalogue, locale),
    amountText: facts.amountVnd === null ? "" : amountTextOf(facts.amountVnd, locale),
    address: facts.address,
    paid: facts.paid,
})

/**
 * The order card with the photo of each item filled in from the catalogue: the photo of the catalogue item with the same name (names are compared
 * without accents or case). A line that has a photo keeps it; an item the catalogue lacks or lists without a photo stays without one, and the thread draws a sprout.
 */
export const orderCardWithPhotos = (card: LineOrder, catalogue: ReadonlyArray<CatalogueImageRow>): LineOrder => {
    const photos = new Map(
        catalogue.flatMap((row) =>
            row.imageUrl === null || row.imageUrl === "" ? [] : [[nameKey(row.name), row.imageUrl] as const],
        ),
    )
    return {
        ...card,
        lines: card.lines.map((line) => {
            if (line.imageUrl !== undefined && line.imageUrl !== null && line.imageUrl !== "") return line
            const imageUrl = photos.get(nameKey(line.name))
            return imageUrl === undefined ? line : { ...line, imageUrl }
        }),
    }
}

/**
 * The card of the order a message to the customer is about, from the order record's own fields (`orderNo`, `amountVnd`, `items`,
 * `deliveryAddress` or the older `note`, `status`): paid when the record says `paid`. A row with no order number is no order, so none.
 * The step that sends the message builds it from the record it read and hands the finished card to `nivo.tool.customer.message.send`.
 */
export const lineOrderOfRow = (
    row: Readonly<Record<string, unknown>> | undefined,
    locale: NoticeLocale,
): LineOrder | undefined =>
    typeof row?.orderNo === "string"
        ? orderCardOf(
              {
                  orderNo: row.orderNo,
                  amountVnd: typeof row.amountVnd === "number" ? row.amountVnd : null,
                  items: row.items,
                  address: orderAddressOf(row),
                  paid: row.status === "paid",
              },
              [],
              locale,
          )
        : undefined
