/** The id a save answers. */
export interface SavedItem {
    readonly id: string
}

/** What a stock adjustment answered: applied now, or waiting for the owner. */
export interface AdjustItem {
    readonly state: "applied" | "waiting"
}

/** What a stock count answered. */
export interface StockTakeItem {
    readonly applied: number
    readonly waiting: number
    readonly same: number
}

/** What a pasted table import answered. */
export interface ImportItem {
    readonly created: number
    readonly updated: number
    readonly stocked: number
    readonly skipped: ReadonlyArray<string>
}

/** What loading a starter set answered. */
export interface StarterItem {
    readonly items: number
    readonly suppliers: number
    readonly recipes: number
}

/** What drafting the low-stock orders answered. */
export interface DraftLowItem {
    readonly drafted: number
    readonly low: number
}

/** What asking the owner to send an order answered. */
export interface SendItem {
    readonly status: string
}

/** What receiving goods answered. */
export interface ReceiveItem {
    readonly status: "partially_received" | "received"
    readonly priceChanges: ReadonlyArray<string>
    readonly handedToAccounting: boolean
}
/** What a person types to add or change an item. */
export interface ItemInput {
    /** The item to change; absent adds one. */
    readonly id?: string
    readonly sku: string
    readonly name: string
    readonly unit: string
    readonly units: string
    readonly category: string
    readonly cost: string
    readonly sell: string
    readonly reorderPoint: string
    readonly reorderQty: string
    readonly supplierId: string
    readonly aliases: string
    /** The opening quantity; only a new item takes it. */
    readonly openingQty?: string
}

/** What a person types to add or change a supplier. */
export interface SupplierInput {
    /** The supplier to change; absent adds one. */
    readonly id?: string
    readonly name: string
    readonly contactName: string
    readonly email: string
    readonly phone: string
    readonly zalo: string
    readonly channel: string
    readonly leadTime: string
    readonly terms: string
    readonly note: string
}

/** One ingredient line of a recipe form. */
export interface RecipeLineInput {
    readonly itemId: string
    readonly qty: string
}

/** What a person types to add or change a recipe. */
export interface RecipeInput {
    /** The recipe to change; absent adds one. */
    readonly id?: string
    readonly name: string
    readonly aliases: string
    readonly lines: ReadonlyArray<RecipeLineInput>
}

/** A quantity change of one item: a signed change or a counted level. */
export interface AdjustInput {
    readonly itemId: string
    readonly locationId?: string
    readonly delta?: number
    readonly counted?: number
    readonly reason: string
}

/** One counted item of a stock count. */
export interface CountInput {
    readonly itemId: string
    readonly counted: number
}

/** A move of goods between two locations. */
export interface TransferInput {
    readonly itemId: string
    readonly fromLocationId: string
    readonly toLocationId: string
    readonly qty: number
    readonly note: string
}

/** One line of a new purchase order. */
export interface NewPoLineInput {
    readonly itemId: string
    readonly qty: string
    readonly unitCost: string
}

/** What a person types to create a purchase order. */
export interface NewPoInput {
    readonly supplierId: string
    readonly expectedAt: string
    readonly lines: ReadonlyArray<NewPoLineInput>
}

/** One edited line of a draft purchase order. */
export interface DraftLineInput {
    readonly lineId: string
    readonly qty: string
    readonly unitCost: string
}

/** What a person changes in a draft purchase order. */
export interface DraftPoInput {
    readonly poId: string
    readonly supplierId: string
    readonly expectedAt: string
    readonly lines: ReadonlyArray<DraftLineInput>
}

/** What a person records when goods arrive. */
export interface ReceiveInput {
    readonly poId: string
    readonly invoiceNo: string
    readonly note: string
    readonly lines: ReadonlyArray<DraftLineInput>
}

/** One supplier of a starter set. */
export interface StarterSupplierInput {
    readonly name: string
    readonly contactName?: string
    readonly email?: string
    readonly phone?: string
    readonly zalo?: string
    readonly channel: string
    readonly leadTimeDays: number
    readonly paymentTerms?: string
}

/** One alternative unit of a starter item. */
export interface StarterUnitInput {
    readonly unit: string
    readonly factor: number
}

/** One item of a starter set. */
export interface StarterItemInput {
    readonly sku: string
    readonly name: string
    readonly unit: string
    readonly units?: ReadonlyArray<StarterUnitInput>
    readonly category: string
    readonly costVnd: number
    readonly sellPriceVnd?: number
    readonly reorderPoint: number
    readonly reorderQty: number
    readonly supplier?: string
    readonly aliases?: ReadonlyArray<string>
    readonly qty: number
}

/** One ingredient of a starter recipe. */
export interface StarterRecipeLineInput {
    readonly sku: string
    readonly qty: number
}

/** One recipe of a starter set. */
export interface StarterRecipeInput {
    readonly name: string
    readonly aliases?: ReadonlyArray<string>
    readonly lines: ReadonlyArray<StarterRecipeLineInput>
}

/** A starter set of suppliers, items and recipes for one kind of business. */
export interface StarterInput {
    readonly name: string
    readonly suppliers: ReadonlyArray<StarterSupplierInput>
    readonly items: ReadonlyArray<StarterItemInput>
    readonly recipes: ReadonlyArray<StarterRecipeInput>
}
