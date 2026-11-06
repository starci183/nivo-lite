import { wordOf } from "../../messages/catalog"
import { ASK_WORDS } from "./ask-missing.messages"
import type { AskLocale } from "./ask-missing.messages"
import type { MissingReason, OrderGap, OrderItem } from "./order.schema"

/** A catalogue row as the data port reads it. */
export interface CatalogueRow {
    /** The catalogue item id. */
    readonly id: string
    /** False for an item the shop no longer sells. */
    readonly active: boolean
    /** The product name. */
    readonly name: string
    /** The price of one, VND, or null when the shop has not priced it. */
    readonly priceVnd: number | null
}

/** The comparable form of a name: without accents, case or extra spaces, so a name typed with accents meets the same name typed without. */
export const nameKey = (name: string): string =>
    name
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replaceAll(wordOf("letterD"), "d")
        .replaceAll(wordOf("letterDCapital"), "D")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()

/** The items with equal names merged (their quantities added) and the blank ones dropped. */
export const mergedItems = (items: ReadonlyArray<OrderItem>): ReadonlyArray<OrderItem> => {
    const merged = new Map<string, OrderItem>()
    for (const item of items) {
        const key = nameKey(item.name)
        if (key === "") continue
        const known = merged.get(key)
        merged.set(
            key,
            known === undefined
                ? { ...item, name: item.name.trim().replace(/\s+/g, " ") }
                : { ...known, quantity: known.quantity + item.quantity, priceVnd: known.priceVnd ?? item.priceVnd },
        )
    }
    return [...merged.values()]
}

/** The sum of quantity times price, or null while any line has no price. */
export const totalOf = (items: ReadonlyArray<OrderItem>): number | null => {
    let total = 0
    for (const item of items) {
        if (item.priceVnd === null) return null
        total += item.quantity * item.priceVnd
    }
    return total
}

/** The items with the catalogue's name and price in place of the customer's, and the gaps found. */
export interface Priced {
    /** The items the active catalogue knows, priced. */
    readonly items: ReadonlyArray<OrderItem>
    /** What is missing. */
    readonly gaps: ReadonlyArray<OrderGap>
}

const gapOf = (reason: MissingReason, item: string | null): OrderGap => ({ reason, item })

/** Prices every item from the catalogue; an item it does not list, or lists without a price, is a gap. */
export const pricedFrom = (items: ReadonlyArray<OrderItem>, catalogue: ReadonlyArray<CatalogueRow>): Priced => {
    const known = new Map(catalogue.filter((row) => row.active).map((row) => [nameKey(row.name), row]))
    const priced: Array<OrderItem> = []
    const gaps: Array<OrderGap> = []
    for (const item of items) {
        const row = known.get(nameKey(item.name))
        if (row === undefined) gaps.push(gapOf("not_in_catalogue", item.name))
        else if (row.priceVnd === null) gaps.push(gapOf("no_price", item.name))
        else priced.push({ name: row.name, quantity: item.quantity, priceVnd: row.priceVnd, catalogueItemId: row.id })
    }
    return { items: priced, gaps }
}

/** Every gap of an order: no items, items the catalogue lacks or has not priced, and no address. */
export const gapsOf = (
    items: ReadonlyArray<OrderItem>,
    address: string | null,
    catalogue: ReadonlyArray<CatalogueRow>,
): Priced => {
    const priced = pricedFrom(items, catalogue)
    const gaps = [
        ...(items.length === 0 ? [gapOf("no_items", null)] : []),
        ...priced.gaps,
        ...(address === null || address.trim() === "" ? [gapOf("no_address", null)] : []),
    ]
    return { items: priced.items, gaps }
}

/** An item as the `order.record` effect carries it. */
export interface RecordedItem {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
    /** The price of one, when known. */
    readonly unitPriceVnd?: number
    /** The catalogue item, when matched. */
    readonly catalogueItemId?: string
}

/** The items with the active catalogue's id, name and price where the catalogue knows them; the others stay as asked. */
export const resolvedItems = (
    items: ReadonlyArray<OrderItem>,
    catalogue: ReadonlyArray<CatalogueRow>,
): ReadonlyArray<OrderItem> => {
    const known = new Map(catalogue.filter((row) => row.active).map((row) => [nameKey(row.name), row]))
    return items.map((item) => {
        const row = known.get(nameKey(item.name))
        return row === undefined
            ? item
            : {
                  name: row.name,
                  quantity: item.quantity,
                  priceVnd: row.priceVnd ?? item.priceVnd,
                  catalogueItemId: row.id,
              }
    })
}

/** The items in the shape of the `order.record` effect payload. */
export const recordedItemsOf = (items: ReadonlyArray<OrderItem>): ReadonlyArray<RecordedItem> =>
    items.map((item) => ({
        name: item.name,
        qty: item.quantity,
        ...(item.priceVnd === null ? {} : { unitPriceVnd: item.priceVnd }),
        ...(item.catalogueItemId === undefined ? {} : { catalogueItemId: item.catalogueItemId }),
    }))

/** The question that asks the customer for what the order lacks: the opening line, then one line per gap. */
export const askTextOf = (gaps: ReadonlyArray<OrderGap>, locale: AskLocale): string => {
    const words = ASK_WORDS[locale]
    return [words.intro, ...gaps.map((gap) => words.reasons[gap.reason].replace("{{item}}", gap.item ?? ""))].join("\n")
}
