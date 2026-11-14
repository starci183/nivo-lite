import { z } from "zod"
import type { LineOrder } from "@nivo-lite/agent-sdk/customer-send"

const TEXT = 2000

/**
 * The order a line of an agent told, as the sender wrote it (`LineOrder` of the agent SDK, the `order_card` of `customer_messages`):
 * the order number, the items (name, how many, the price of one and of the line in words, the photo), the total in words, where to
 * deliver and whether it was paid when the line was sent. Every amount is already text with its currency: the card never re-formats it.
 */
const lineOrderSchema: z.ZodType<LineOrder> = z.object({
    orderNo: z.string().max(TEXT),
    lines: z
        .array(
            z.object({
                name: z.string().max(TEXT),
                qty: z.number(),
                unitText: z.string().max(TEXT).optional(),
                amountText: z.string().max(TEXT).optional(),
                imageUrl: z.string().max(TEXT).nullable().optional(),
            }),
        )
        .max(50),
    amountText: z.string().max(TEXT),
    address: z.string(),
    paid: z.boolean(),
})

/** The order a line's `orderJson` holds; null when the line has none or the text does not read as an order (the line then shows its words alone). */
export const lineOrderOf = (orderJson: string | null | undefined): LineOrder | null => {
    if (orderJson === null || orderJson === undefined || orderJson === "") return null
    try {
        const parsed = lineOrderSchema.safeParse(JSON.parse(orderJson))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}
