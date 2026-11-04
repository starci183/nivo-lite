/** One catalogue item a seed wants in a workspace: the stock-keeping code is its key. */
export interface SeedItemParams {
    /** The stock-keeping code; the same in every run, so a rerun finds the item. */
    readonly sku: string
    /** The name shown to customers. */
    readonly name: string
    /** The unit one price is for. */
    readonly unit: string
    /** The selling price of one unit, in VND. */
    readonly sellPriceVnd: number
}

/** What a seed did to one item: wrote a new one, brought a differing one back, or found it already as wanted. */
export type SeedItemOutcome = "created" | "updated" | "kept"
