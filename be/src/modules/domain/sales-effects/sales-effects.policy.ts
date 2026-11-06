import type { OrderRow } from "@nivo-lite/blocks-core/modules/sales"
import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { recordIdSchema } from "./sales-effects.schema"

/** What a schema answers when it reads a value: the value, or that it is not the shape. */
interface Readable<T> {
    /** Reads the value without throwing. */
    readonly safeParse: (value: unknown) => { readonly success: true; readonly data: T } | { readonly success: false }
}

/** Whether a text is an id of a record (a uuid); anything else names no record. */
export const isRecordId = (id: string): boolean => recordIdSchema.safeParse(id).success

/** What a payload reads to under the schema of its effect, or the refusal that it is not what the effect asks for. */
export const payloadOf = <T>(schema: Readable<T>, payload: unknown): T => {
    const parsed = schema.safeParse(payload)
    if (!parsed.success) throw new SalesEffectsError({ code: SalesEffectsErrorCode.InvalidPayload })
    return parsed.data
}

/** The statuses of an order that is still open for the customer: the same request is not recorded again beside it. */
export const OPEN_ORDER: ReadonlyArray<string> = ["draft", "confirmed"]

/** What a request to record an order asks for, once priced. */
export interface OrderRequest {
    /** The priced lines, in the order the customer named them. */
    readonly lines: OrderRow["items"]["lines"]
    /** The total, VND, or null while a line has no price. */
    readonly amountVnd: number | null
    /** The delivery address and notes; empty when none. */
    readonly note: string
}

/**
 * Whether an order of the customer already stands for the request: it is open (a draft or confirmed), and has the same lines, the same
 * total and the same note. Recording that request again reuses the order, so a customer who repeats themselves (or a run that is run
 * again) does not get two.
 */
export const standsFor = (
    order: Pick<OrderRow, "status" | "items" | "amountVnd" | "note">,
    request: OrderRequest,
): boolean =>
    OPEN_ORDER.includes(order.status) &&
    order.amountVnd === request.amountVnd &&
    order.note === request.note &&
    order.items.lines.length === request.lines.length &&
    order.items.lines.every((line, index) => {
        const asked = request.lines[index]
        return (
            line.name === asked?.name &&
            line.qty === asked.qty &&
            line.unitVnd === asked.unitVnd &&
            line.amountVnd === asked.amountVnd
        )
    })
