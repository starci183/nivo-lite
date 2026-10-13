/** What the request to create or update one catalogue item takes. */
export interface SaveItemParams {
    /** The item to update; absent creates one. */
    readonly id?: string
    /** The item code; empty derives one from the name. */
    readonly sku: string
    /** The item name. */
    readonly name: string
    /** The base unit all quantities are kept in. */
    readonly unit: string
    /** Other units as text, `unit=factor` pairs separated by commas. */
    readonly units: string
    /** The item group. */
    readonly category: string
    /** The cost per base unit as typed. */
    readonly cost: string
    /** The selling price per base unit as typed; empty for none. */
    readonly sell: string
    /** The stock level at or below which the item is low, as typed. */
    readonly reorderPoint: string
    /** The usual order quantity, as typed. */
    readonly reorderQty: string
    /** The usual supplier id; empty for none. */
    readonly supplierId: string
    /** Other names an order line may use, separated by commas. */
    readonly aliases: string
    /** The opening quantity, as typed; only a new item takes it. */
    readonly openingQty?: string
}

/** What the request to create or update one catalogue item answers. */
export interface SaveItemOutput {
    /** The item id. */
    readonly id: string
}

/** What the request to switch an item on or off takes. */
export interface SetItemActiveParams {
    /** The item. */
    readonly id: string
    /** Whether the item is in use. */
    readonly active: boolean
}

/** What the request to create or update one supplier takes. */
export interface SaveSupplierParams {
    /** The supplier to update; absent creates one. */
    readonly id?: string
    /** The supplier name. */
    readonly name: string
    /** The contact person. */
    readonly contactName: string
    /** The order email address. */
    readonly email: string
    /** The phone number. */
    readonly phone: string
    /** The Zalo contact. */
    readonly zalo: string
    /** How orders reach the supplier: email, zalo or phone. */
    readonly channel: string
    /** The delivery time in days, as typed. */
    readonly leadTime: string
    /** The payment terms. */
    readonly terms: string
    /** A free note. */
    readonly note: string
}

/** What the request to create or update one supplier answers. */
export interface SaveSupplierOutput {
    /** The supplier id. */
    readonly id: string
}

/** One ingredient of a recipe. */
export interface SaveRecipeLine {
    /** The ingredient item. */
    readonly itemId: string
    /** The quantity per product, as typed. */
    readonly qty: string
}

/** What the request to create or update one recipe takes. */
export interface SaveRecipeParams {
    /** The recipe to update; absent creates one. */
    readonly id?: string
    /** The product name as it appears on an order. */
    readonly name: string
    /** Other names, separated by commas. */
    readonly aliases: string
    /** The ingredients per product. */
    readonly lines: ReadonlyArray<SaveRecipeLine>
}

/** What the request to create or update one recipe answers. */
export interface SaveRecipeOutput {
    /** The recipe id. */
    readonly id: string
}

/** What the request to delete one recipe takes. */
export interface DeleteRecipeParams {
    /** The recipe. */
    readonly id: string
}

/** What the request to create or rename one stock location takes. */
export interface SaveLocationParams {
    /** The location to rename; absent creates one. */
    readonly id?: string
    /** The location name. */
    readonly name: string
}

/** What the request to import items from a pasted table takes. */
export interface ImportPasteParams {
    /** The pasted rows of a sheet or CSV. */
    readonly raw: string
}

/** What the request to import items from a pasted table answers. */
export interface ImportPasteOutput {
    /** Items created. */
    readonly created: number
    /** Items updated. */
    readonly updated: number
    /** Items given an opening quantity. */
    readonly stocked: number
    /** The lines that could not be read. */
    readonly skipped: ReadonlyArray<string>
}

/** One supplier of a starter. */
export interface StarterSupplier {
    /** The supplier name. */
    readonly name: string
    /** The contact person. */
    readonly contactName?: string
    /** The order email address. */
    readonly email?: string
    /** The phone number. */
    readonly phone?: string
    /** The Zalo contact. */
    readonly zalo?: string
    /** How orders reach the supplier. */
    readonly channel: string
    /** The delivery time in days. */
    readonly leadTimeDays: number
    /** The payment terms. */
    readonly paymentTerms?: string
}

/** One other unit of an item. */
export interface StarterUnit {
    /** The unit name. */
    readonly unit: string
    /** How many base units one of this unit holds. */
    readonly factor: number
}

/** One item of a starter. */
export interface StarterItem {
    /** The item code. */
    readonly sku: string
    /** The item name. */
    readonly name: string
    /** The base unit. */
    readonly unit: string
    /** Other units. */
    readonly units?: ReadonlyArray<StarterUnit>
    /** The item group. */
    readonly category: string
    /** The cost per base unit. */
    readonly costVnd: number
    /** The selling price per base unit. */
    readonly sellPriceVnd?: number
    /** The low-stock level. */
    readonly reorderPoint: number
    /** The usual order quantity. */
    readonly reorderQty: number
    /** The supplier name. */
    readonly supplier?: string
    /** Other names. */
    readonly aliases?: ReadonlyArray<string>
    /** The opening quantity. */
    readonly qty: number
}

/** One ingredient of a starter recipe. */
export interface StarterRecipeLine {
    /** The ingredient item code. */
    readonly sku: string
    /** The quantity per product. */
    readonly qty: number
}

/** One recipe of a starter. */
export interface StarterRecipe {
    /** The product name. */
    readonly name: string
    /** Other names. */
    readonly aliases?: ReadonlyArray<string>
    /** The ingredients. */
    readonly lines: ReadonlyArray<StarterRecipeLine>
}

/** What the request to load a starter set of suppliers, items and recipes takes. */
export interface ApplyStarterParams {
    /** The starter name used in the log. */
    readonly name: string
    /** The suppliers to add. */
    readonly suppliers: ReadonlyArray<StarterSupplier>
    /** The items to add. */
    readonly items: ReadonlyArray<StarterItem>
    /** The recipes to add. */
    readonly recipes: ReadonlyArray<StarterRecipe>
}

/** What the request to load a starter set of suppliers, items and recipes answers. */
export interface ApplyStarterOutput {
    /** Items created. */
    readonly items: number
    /** Suppliers created. */
    readonly suppliers: number
    /** Recipes created. */
    readonly recipes: number
}

/** What the request to take a confirmed order out of stock takes. */
export interface DeductOrderParams {
    /** The order id: the idempotency key of the deduction. */
    readonly orderId: string
    /** The order number shown to people. */
    readonly orderNo: string
    /** The ordered items as the customer wrote them. */
    readonly items: string
}

/** What the request to change one item's quantity by hand takes. */
export interface AdjustStockParams {
    /** The item. */
    readonly itemId: string
    /** The location; absent means the default one. */
    readonly locationId?: string
    /** The signed change in base units. */
    readonly delta?: number
    /** The counted quantity; it sets the level instead of adding. */
    readonly counted?: number
    /** Why the quantity changes. */
    readonly reason: string
}

/** What the request to change one item's quantity by hand answers. */
export interface AdjustStockOutput {
    /** `applied` when the change is in, `waiting` when the owner must approve it. */
    readonly state: "applied" | "waiting"
    /** The level before the change. */
    readonly before?: number
    /** The level after the change. */
    readonly after?: number
    /** The decision waiting for the owner. */
    readonly workItemId?: string
}

/** One counted item. */
export interface StockTakeCount {
    /** The item. */
    readonly itemId: string
    /** The counted quantity. */
    readonly counted: number
}

/** What the request to apply a stock count takes. */
export interface StockTakeParams {
    /** The counted items. */
    readonly counts: ReadonlyArray<StockTakeCount>
}

/** What the request to apply a stock count answers. */
export interface StockTakeOutput {
    /** Changes applied now. */
    readonly applied: number
    /** Changes waiting for the owner. */
    readonly waiting: number
    /** Items whose count matched. */
    readonly same: number
}

/** What the request to move goods between two locations takes. */
export interface TransferStockParams {
    /** The item. */
    readonly itemId: string
    /** The source location. */
    readonly fromLocationId: string
    /** The target location. */
    readonly toLocationId: string
    /** The quantity to move. */
    readonly qty: number
    /** A free note. */
    readonly note: string
}

/** What the request to move goods between two locations answers. */
export interface TransferStockOutput {
    /** The level left at the source. */
    readonly from: number
    /** The level at the target. */
    readonly to: number
}

/** What the request to draft purchase orders for low items answers. */
export interface DraftLowStockOutput {
    /** Purchase orders drafted. */
    readonly drafted: number
    /** Items found low. */
    readonly low: number
}

/** One ordered item. */
export interface CreatePoLine {
    /** The item. */
    readonly itemId: string
    /** The quantity, as typed. */
    readonly qty: string
    /** The unit cost, as typed. */
    readonly unitCost: string
}

/** What the request to create a purchase order takes. */
export interface CreatePoParams {
    /** The supplier id; empty for none. */
    readonly supplierId: string
    /** The expected date, YYYY-MM-DD, or empty. */
    readonly expectedAt: string
    /** The ordered items. */
    readonly lines: ReadonlyArray<CreatePoLine>
}

/** What the request to create a purchase order answers. */
export interface CreatePoOutput {
    /** The purchase order id. */
    readonly id: string
}

/** One line to change. */
export interface UpdatePoLine {
    /** The line. */
    readonly lineId: string
    /** The quantity, as typed; zero removes the line. */
    readonly qty: string
    /** The unit cost, as typed. */
    readonly unitCost: string
}

/** What the request to edit a draft purchase order takes. */
export interface UpdatePoDraftParams {
    /** The purchase order. */
    readonly poId: string
    /** The supplier id; empty for none. */
    readonly supplierId: string
    /** The expected date, YYYY-MM-DD, or empty. */
    readonly expectedAt: string
    /** The lines to change. */
    readonly lines: ReadonlyArray<UpdatePoLine>
}

/** What the request to put a purchase order before the owner to send takes. */
export interface RequestSendParams {
    /** The purchase order. */
    readonly poId: string
    /** Whether to send the order or remind the supplier. */
    readonly kind: "order" | "reminder"
}

/** What the request to put a purchase order before the owner to send answers. */
export interface RequestSendOutput {
    /** The status of the decision. */
    readonly status: string
}

/** What the request to cancel a purchase order takes. */
export interface CancelPoParams {
    /** The purchase order. */
    readonly poId: string
}

/** One received line. */
export interface ReceivePoLine {
    /** The order line. */
    readonly lineId: string
    /** The received quantity, as typed. */
    readonly qty: string
    /** The actual unit cost, as typed; empty keeps the ordered cost. */
    readonly unitCost: string
}

/** What the request to receive goods against a purchase order takes. */
export interface ReceivePoParams {
    /** The purchase order. */
    readonly poId: string
    /** The supplier invoice number. */
    readonly invoiceNo: string
    /** A free note. */
    readonly note: string
    /** The received lines. */
    readonly lines: ReadonlyArray<ReceivePoLine>
}

/** What the request to receive goods against a purchase order answers. */
export interface ReceivePoOutput {
    /** The order status after the receipt. */
    readonly status: "partially_received" | "received"
    /** Lines received. */
    readonly received: number
    /** The lines whose price differed from the order. */
    readonly priceChanges: ReadonlyArray<string>
    /** The value of the goods. */
    readonly payableVnd: number
    /** Whether the payable went to Accounting. */
    readonly handedToAccounting: boolean
}
