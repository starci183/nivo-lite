/** The schema name a catalogue seed document carries. */
export const CATALOGUE_SEED_SCHEMA = "nivo/catalogue-seed@1"

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
}
