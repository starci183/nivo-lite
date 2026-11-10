import type { OrderRow } from "@nivo-lite/blocks-core/modules/sales"
import { foldText } from "@nivo-lite/blocks-core/rules/sales"
import type { PricedLine } from "@nivo-lite/blocks-core/rules/sales"
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
    /** The total, VND. */
    readonly amountVnd: number
    /** What else the customer asked for; empty when nothing. */
    readonly note: string
    /** Where the order is delivered, or null. */
    readonly deliveryAddress: string | null
    /** The name of the person who receives the delivery, or null (the customer). */
    readonly recipientName: string | null
    /** The phone of the person who receives the delivery, or null. */
    readonly recipientPhone: string | null
    /** The day and time window of the delivery in the customer's words, or null. */
    readonly deliveryAt: string | null
}

/** A catalogue item as pricing reads it. */
export interface CatalogueRow {
    /** The item id. */
    readonly id: string
    /** The name the shop sells it under. */
    readonly name: string
    /** The price of one, VND, or null while the shop has not priced it. */
    readonly priceVnd: number | null
    /** Whether the shop sells it now. */
    readonly active: boolean
}

/** One thing a customer asks for: a catalogue item by id, else by the name they used, and how many. */
export interface AskedItem {
    /** The catalogue item id, when the caller knows it. */
    readonly catalogueItemId?: string | undefined
    /** The name the customer used. */
    readonly name?: string | undefined
    /** How many. */
    readonly qty: number
}

/** The lines of a request priced by the catalogue, or the first item it cannot price and why. */
export type PricedRequest =
    | { readonly lines: ReadonlyArray<PricedLine> }
    | { readonly refused: "item_unknown" | "item_unpriced"; readonly name: string }

/** The active catalogue item an asked item names: by its id, else by its name without accents, case or extra spaces. */
const itemOf = (asked: AskedItem, catalogue: ReadonlyArray<CatalogueRow>): CatalogueRow | undefined => {
    const active = catalogue.filter((row) => row.active)
    const byId = asked.catalogueItemId === undefined ? undefined : active.find((row) => row.id === asked.catalogueItemId)
    if (byId !== undefined || asked.name === undefined) return byId
    const wanted = foldText(asked.name)
    return active.find((row) => foldText(row.name) === wanted)
}

/**
 * Prices what a customer asks for from the shop's catalogue: each line takes the catalogue's name and price, and comes to quantity times
 * that price. The caller gives no price, so none of its numbers can reach an order. An item the active catalogue does not list
 * (`item_unknown`) or lists without a price (`item_unpriced`) refuses the whole request, naming the item as asked.
 */
export const pricedFromCatalogue = (
    items: ReadonlyArray<AskedItem>,
    catalogue: ReadonlyArray<CatalogueRow>,
): PricedRequest => {
    const lines: Array<PricedLine> = []
    for (const asked of items) {
        const row = itemOf(asked, catalogue)
        const name = asked.name ?? asked.catalogueItemId ?? ""
        if (row === undefined) return { refused: "item_unknown", name }
        if (row.priceVnd === null) return { refused: "item_unpriced", name: row.name }
        lines.push({ name: row.name, qty: asked.qty, unitVnd: row.priceVnd, amountVnd: Math.round(asked.qty * row.priceVnd) })
    }
    return { lines }
}

/** A given text trimmed, or null when it is absent or blank. */
export const textOrNull = (text: string | undefined): string | null =>
    text === undefined || text.trim() === "" ? null : text.trim()

/**
 * Whether an order of the customer already stands for the request: it is open (a draft or confirmed), and has the same lines, the same
 * total, the same note, delivery address, recipient and delivery time. Recording that request again reuses the order, so a customer who repeats themselves (or a run that is run
 * again) does not get two.
 */
export const standsFor = (
    order: Pick<
        OrderRow,
        "status" | "items" | "amountVnd" | "note" | "deliveryAddress" | "recipientName" | "recipientPhone" | "deliveryAt"
    >,
    request: OrderRequest,
): boolean =>
    OPEN_ORDER.includes(order.status) &&
    order.amountVnd === request.amountVnd &&
    order.note === request.note &&
    order.deliveryAddress === request.deliveryAddress &&
    order.recipientName === request.recipientName &&
    order.recipientPhone === request.recipientPhone &&
    order.deliveryAt === request.deliveryAt &&
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
