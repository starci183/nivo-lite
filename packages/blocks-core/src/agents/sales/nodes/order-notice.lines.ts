import type { OrderSummaryLine } from "../../../shared/agent-message/sales-agent-message-kinds"
import { ORDER_ITEMS_SHAPE } from "../entities/order.entity"
import { nameKey } from "./order/order.policy"
import { amountTextOf, type NoticeLocale } from "./order-notice.policy"

/** A catalogue row as the notices read it for the photo of an ordered item. */
export interface CatalogueImageRow {
    /** The product name. */
    readonly name: string
    /** The public address of the photo, or null when the item has none. */
    readonly imageUrl: string | null
}

/** The most catalogue rows one notice reads. */
export const CATALOGUE_IMAGE_LIMIT = 500

/**
 * The lines of an order as the message card draws them: the name, how many, the price of one and of the line in words, and the photo of the
 * catalogue item with the same name (names are compared without accents or case). An item the catalogue lacks, or lists without a photo,
 * carries no `imageUrl`, so the card draws its neutral tile; an order whose lines cannot be read (an older record) has none, and a line with no price carries no price text.
 */
export const summaryLinesOf = (
    items: unknown,
    catalogue: ReadonlyArray<CatalogueImageRow>,
    locale: NoticeLocale,
): ReadonlyArray<OrderSummaryLine> => {
    const parsed = ORDER_ITEMS_SHAPE.safeParse(items)
    if (!parsed.success) return []
    const photos = new Map(
        catalogue.flatMap((row) => (row.imageUrl === null || row.imageUrl === "" ? [] : [[nameKey(row.name), row.imageUrl] as const])),
    )
    return parsed.data.lines.map((line) => {
        const imageUrl = photos.get(nameKey(line.name))
        const isPriced = line.unitVnd > 0 || line.amountVnd > 0
        return {
            name: line.name,
            qty: line.qty,
            ...(isPriced ? { unitText: amountTextOf(line.unitVnd, locale), amountText: amountTextOf(line.amountVnd, locale) } : {}),
            ...(imageUrl === undefined ? {} : { imageUrl }),
        }
    })
}
