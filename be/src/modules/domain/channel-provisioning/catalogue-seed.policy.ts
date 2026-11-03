import { invalid, readSeedDocuments, textOf } from "./management-seed.policy"
import { CATALOGUE_SEED_SCHEMA } from "./catalogue-seed.contracts"
import type { CatalogueItem } from "./catalogue-seed.contracts"

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,39}$/u

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const itemOf = (raw: unknown): CatalogueItem => {
    if (!isRecord(raw)) return invalid("item")
    const sku = textOf(raw.sku, "item.sku")
    const price = raw.sellPriceVnd
    if (!SKU_PATTERN.test(sku)) return invalid("item.sku")
    if (typeof price !== "number" || !Number.isInteger(price) || price < 0) return invalid("item.sellPriceVnd")
    return { sku, name: textOf(raw.name, "item.name"), unit: textOf(raw.unit, "item.unit"), sellPriceVnd: price }
}

/** The items of the catalogue documents of the stack seed envelope: a sku given twice is refused, by the field's name. */
export const readCatalogueItems = (text: string): ReadonlyArray<CatalogueItem> => {
    const items = readSeedDocuments(text).flatMap((document) => {
        if (!isRecord(document) || document.schema !== CATALOGUE_SEED_SCHEMA) return invalid("schema")
        return Array.isArray(document.items) && document.items.length > 0 ? document.items.map(itemOf) : invalid("items")
    })
    return new Set(items.map((item) => item.sku)).size === items.length ? items : invalid("item.sku")
}
