import { invalid, readSeedDocuments, textOf } from "./management-seed.policy"
import { CATALOGUE_SEED_SCHEMA } from "./catalogue-seed.contracts"
import type { CatalogueItem, CatalogueItemImage } from "./catalogue-seed.contracts"

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,39}$/u

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

/** The content types a photo may have, and the largest one (as base64 text; a photo is a small picture). */
const IMAGE_TYPES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp"])
const IMAGE_BASE64_MAX = 2_000_000
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u

const imageOf = (raw: unknown): CatalogueItemImage | undefined => {
    if (raw === undefined) return undefined
    if (!isRecord(raw)) return invalid("item.image")
    const contentType = textOf(raw.contentType, "item.image.contentType")
    const base64 = raw.base64
    if (!IMAGE_TYPES.has(contentType)) return invalid("item.image.contentType")
    if (typeof base64 !== "string" || base64.length > IMAGE_BASE64_MAX || !BASE64.test(base64)) return invalid("item.image.base64")
    return { contentType, base64 }
}

/** An item as the document writes it: the photo it carries, or the sku of the item whose photo it shares. */
interface RawItem {
    readonly item: CatalogueItem
    readonly imageOf: string | undefined
}

const itemOf = (raw: unknown): RawItem => {
    if (!isRecord(raw)) return invalid("item")
    const sku = textOf(raw.sku, "item.sku")
    const price = raw.sellPriceVnd
    if (!SKU_PATTERN.test(sku)) return invalid("item.sku")
    if (typeof price !== "number" || !Number.isInteger(price) || price < 0) return invalid("item.sellPriceVnd")
    const image = imageOf(raw.image)
    const sharedWith = raw.imageOf === undefined ? undefined : textOf(raw.imageOf, "item.imageOf")
    if (sharedWith !== undefined && (image !== undefined || !SKU_PATTERN.test(sharedWith) || sharedWith === sku)) {
        return invalid("item.imageOf")
    }
    return {
        item: {
            sku,
            name: textOf(raw.name, "item.name"),
            unit: textOf(raw.unit, "item.unit"),
            sellPriceVnd: price,
            ...(image === undefined ? {} : { image }),
        },
        imageOf: sharedWith,
    }
}

/** The items with the photo of the item they share it with (`imageOf`, the sku of an item of the same documents that carries one) filled in. */
const withSharedPhotos = (raws: ReadonlyArray<RawItem>): ReadonlyArray<CatalogueItem> =>
    raws.map(({ item, imageOf: sharedWith }) => {
        if (sharedWith === undefined) return item
        const image = raws.find((other) => other.item.sku === sharedWith)?.item.image
        return image === undefined ? invalid("item.imageOf") : { ...item, image }
    })

/** The items of the catalogue documents of the stack seed envelope: a sku given twice is refused, by the field's name. */
export const readCatalogueItems = (text: string): ReadonlyArray<CatalogueItem> => {
    const raws = readSeedDocuments(text).flatMap((document) => {
        if (!isRecord(document) || document.schema !== CATALOGUE_SEED_SCHEMA) return invalid("schema")
        return Array.isArray(document.items) && document.items.length > 0
            ? document.items.map(itemOf)
            : invalid("items")
    })
    return new Set(raws.map((raw) => raw.item.sku)).size === raws.length ? withSharedPhotos(raws) : invalid("item.sku")
}
