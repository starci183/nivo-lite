/** The schema name a catalogue seed document carries. */
export const CATALOGUE_SEED_SCHEMA = "nivo/catalogue-seed@1"

/** The photo of a catalogue item as the seed carries it: the content type and the bytes in base64. */
export interface CatalogueItemImage {
    /** `image/jpeg`, `image/png` or `image/webp`. */
    readonly contentType: string
    /** The bytes of the photo, in base64. */
    readonly base64: string
}

/** One item of the catalogue of a workspace: the stock-keeping code is its key. */
export interface CatalogueItem {
    /** The stock-keeping code; the same in every run, so a rerun finds the item. */
    readonly sku: string
    /** The name shown to customers. */
    readonly name: string
    /** The unit one price is for. */
    readonly unit: string
    /** The selling price of one unit, in VND. */
    readonly sellPriceVnd: number
    /** The photo of the item, when the seed gives one. */
    readonly image?: CatalogueItemImage
}
