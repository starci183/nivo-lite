/** One other unit of an item: `factor` base units make one of it. */
export interface UnitConversion {
    /** The unit name. */
    readonly unit: string
    /** How many base units one of this unit holds. */
    readonly factor: number
}

/** The two numbers that decide when an item is low and how much to order. */
export interface ReorderRule {
    /** At or below this level the item is low; zero means no reorder level is set. */
    readonly reorderPoint: number
    /** The usual quantity per purchase order; zero means derive it from the reorder point. */
    readonly reorderQty: number
}

/** Out: nothing left. Low: at or below the reorder point. Ok: enough. Over: far above what is needed. */
export type StockStatus = "out" | "low" | "ok" | "over"

/** One catalogue item with its numbers read as numbers. */
export interface InventoryItem extends ReorderRule {
    /** The item id. */
    readonly id: string
    /** The item code. */
    readonly sku: string
    /** The item name. */
    readonly name: string
    /** The base unit all quantities are kept in. */
    readonly unit: string
    /** The other units and their factors. */
    readonly units: ReadonlyArray<UnitConversion>
    /** The item group. */
    readonly category: string
    /** The weighted average cost per base unit. */
    readonly costVnd: number
    /** The selling price per base unit, when the item is sold. */
    readonly sellPriceVnd: number | null
    /** The usual supplier. */
    readonly supplierId: string | null
    /** Other names an order line may use. */
    readonly aliases: ReadonlyArray<string>
    /** Whether the item is in use. */
    readonly active: boolean
}

/** One line of an order text: the quantity, the name part and the line as written. */
export interface OrderLine {
    /** The line as written. */
    readonly raw: string
    /** The ordered quantity; one when the line states none. */
    readonly qty: number
    /** The name part. */
    readonly name: string
}

/** A product made of ingredients, as matching sees it. */
export interface MatchRecipe {
    /** The recipe id. */
    readonly id: string
    /** The product name. */
    readonly name: string
    /** Other names of the product. */
    readonly aliases: ReadonlyArray<string>
}

/** An item as matching sees it. */
export interface MatchItem {
    /** The item id. */
    readonly id: string
    /** The item code. */
    readonly sku: string
    /** The item name. */
    readonly name: string
    /** The base unit. */
    readonly unit: string
    /** The other units and their factors. */
    readonly units: ReadonlyArray<UnitConversion>
    /** Other names an order line may use. */
    readonly aliases: ReadonlyArray<string>
}

/** What an order line matched: a recipe (its ingredients leave stock) or an item, with the quantity in base units. */
export interface LineMatch {
    /** Whether the line matched a recipe or an item. */
    readonly kind: "recipe" | "item"
    /** The recipe or item id. */
    readonly id: string
    /** The quantity: products for a recipe, base units for an item. */
    readonly qty: number
}

/** One row of a pasted item table. */
export interface ImportRow {
    /** The item code; empty derives one from the name. */
    readonly sku: string
    /** The item name. */
    readonly name: string
    /** The base unit. */
    readonly unit: string
    /** The item group. */
    readonly category: string
    /** The cost per base unit. */
    readonly costVnd: number
    /** The selling price per base unit. */
    readonly sellPriceVnd: number | null
    /** The low-stock level. */
    readonly reorderPoint: number
    /** The usual order quantity. */
    readonly reorderQty: number
    /** The opening quantity, when the row states one. */
    readonly qty: number | null
    /** The supplier name. */
    readonly supplier: string
}

/** The kinds of stock movement. */
export type MovementKind = "in" | "out" | "adjust" | "transfer"

/** What a movement refers to. */
export type MovementRef = "manual" | "order" | "po" | "count" | "import" | "transfer"

/** One signed stock movement to apply. */
export interface MovementParams {
    /** The item. */
    readonly itemId: string
    /** The location; absent means the default one. */
    readonly locationId?: string
    /** The kind of movement. */
    readonly kind: MovementKind
    /** The signed change in base units. */
    readonly delta: number
    /** Why the quantity moves. */
    readonly reason: string
    /** What the movement refers to. */
    readonly refType?: MovementRef
    /** The id of the thing it refers to. */
    readonly refId?: string | null
    /** The label of the thing it refers to, such as an order number. */
    readonly refLabel?: string | null
    /** Who moves the stock. */
    readonly by?: string
    /** The proof or detail. */
    readonly evidence?: string | null
    /** The key that makes a repeated movement a no-op. */
    readonly dedupe?: string | null
    /** The unit cost of goods received, which moves the weighted average cost. */
    readonly unitCost?: number | null
}

/** What applying a movement did. */
export interface AppliedMovement {
    /** False when the dedupe key had been used before and nothing changed. */
    readonly applied: boolean
    /** The level before. */
    readonly before: number
    /** The level after. */
    readonly after: number
    /** The item cost after the movement. */
    readonly cost: number
}

/** One manual stock change before it is judged small or big. */
export interface AdjustInput {
    /** The item. */
    readonly itemId: string
    /** The location; absent means the default one. */
    readonly locationId?: string
    /** The signed change in base units. */
    readonly delta?: number
    /** The counted level; it sets the quantity instead of adding. */
    readonly countedQty?: number
    /** Why the quantity changes. */
    readonly reason: string
    /** The proof or detail. */
    readonly evidence?: string
    /** What the change refers to; manual when absent. */
    readonly refType?: MovementRef
}

/** One item that left stock because of an order. */
export interface DeductedLine {
    /** The item. */
    readonly itemId: string
    /** The item name. */
    readonly name: string
    /** The quantity taken, in base units. */
    readonly qty: number
    /** The base unit. */
    readonly unit: string
    /** The level left. */
    readonly after: number
}

/** What deducting an order did. */
export interface DeductResult {
    /** The items taken out of stock. */
    readonly deducted: ReadonlyArray<DeductedLine>
    /** The order lines that matched nothing. */
    readonly unmatched: ReadonlyArray<string>
}

/** An item at or below its reorder point. */
export interface LowItem {
    /** The item. */
    readonly item: InventoryItem
    /** Its total stock. */
    readonly total: number
    /** Whether it is out or only low. */
    readonly status: "out" | "low"
}

/** How a low-stock pass drafts orders. */
export interface DraftOptions {
    /** Check only these items; absent checks all. */
    readonly itemIds?: ReadonlyArray<string>
    /** Who drafts; the system when absent. */
    readonly by?: string
    /** False leaves the approval requests to the caller. */
    readonly requestApproval?: boolean
}

/** What a low-stock pass drafted. */
export interface DraftOutcome {
    /** The drafted or extended purchase orders. */
    readonly poIds: ReadonlyArray<string>
    /** How many items were low. */
    readonly lowCount: number
    /** The names of the low items an open order already covers or the owner forbade. */
    readonly skipped: ReadonlyArray<string>
}

/** The supplier of a loaded purchase order. */
export interface PoSupplier {
    /** The supplier name. */
    readonly name: string
    /** The contact person. */
    readonly contactName: string
    /** The order email address. */
    readonly email: string | null
    /** How orders reach the supplier. */
    readonly channel: "email" | "zalo" | "phone"
    /** The delivery time in days. */
    readonly leadTimeDays: number
}

/** One line of a loaded purchase order. */
export interface PoLine {
    /** The line id. */
    readonly id: string
    /** The ordered item. */
    readonly itemId: string
    /** The ordered quantity. */
    readonly qtyOrdered: number
    /** The quantity received so far. */
    readonly qtyReceived: number
    /** The unit cost. */
    readonly unitCost: number
    /** The item name, absent when the item was deleted. */
    readonly itemName: string | null
    /** The item unit, absent when the item was deleted. */
    readonly itemUnit: string | null
}

/** A purchase order with its supplier and lines. */
export interface LoadedPo {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly poNo: string
    /** The supplier id. */
    readonly supplierId: string | null
    /** The order status. */
    readonly status: string
    /** The order total. */
    readonly totalVnd: number
    /** The expected delivery day, YYYY-MM-DD. */
    readonly expectedAt: string | null
    /** The order message to the supplier. */
    readonly message: string
    /** How many reminders were sent. */
    readonly reminders: number
    /** The supplier, when one is chosen. */
    readonly supplier: PoSupplier | null
    /** The ordered lines. */
    readonly lines: ReadonlyArray<PoLine>
}

/** What a new purchase order is built from. */
export interface CreatePoInput {
    /** The supplier; absent leaves the order without one. */
    readonly supplierId: string | null
    /** The ordered items. */
    readonly lines: ReadonlyArray<PoLineInput>
    /** Who creates the order. */
    readonly by: string
    /** Whether the system drafted it or a person made it. */
    readonly source: "auto" | "manual"
    /** The delivery time in days, which sets the expected day. */
    readonly leadTimeDays: number
    /** The expected day a person typed; it wins over the lead time. */
    readonly expectedAt?: string
}

/** The message the supplier gets. */
export interface ComposedMessage {
    /** The message text. */
    readonly text: string
    /** True when the text generator wrote it, false for the plain template. */
    readonly generated: boolean
}

/** What asking to send an order or a reminder ended in. */
export interface SendRequestResult {
    /** The status of the decision, or of the order when nothing was asked. */
    readonly status: string
    /** The decision, when one was opened. */
    readonly workItemId: string | null
}

/** What a weekly stock report found. */
export interface WeeklyReport {
    /** The report text posted to the Office. */
    readonly text: string
    /** The stock value at weighted average cost. */
    readonly valueVnd: number
    /** How many items are low or out. */
    readonly lowCount: number
    /** How many purchase orders are open. */
    readonly openOrders: number
    /** `none` when no address was given, otherwise whether the mail went out. */
    readonly email: "none" | "sent" | "failed"
}

/** What an overdue reminder did. */
export interface OverdueResult {
    /** `skipped` when the order no longer needs a reminder, `asked` when the reminder waits for a decision, `sent` when it went out. */
    readonly state: "skipped" | "asked" | "sent"
    /** The decision, when one was opened. */
    readonly workItemId: string | null
    /** The reminder number, when one was asked. */
    readonly reminder: number
    /** The order number. */
    readonly poNo: string
}

/** What a replenish pass is asked to do. */
export interface ReplenishParams {
    /** The workspace. */
    readonly workspaceId: string
    /** The items that moved. */
    readonly itemIds: ReadonlyArray<string>
}

/** What reading a pasted item table found. */
export interface ParsedItemTable {
    /** The rows that have a name. */
    readonly rows: Array<ImportRow>
    /** The lines that were skipped because they have no name. */
    readonly skipped: Array<string>
}

/** Whether a purchase order message asks for the goods or reminds the supplier of a late order. */
export type SendKind = "order" | "reminder"

/** One ordered item to add to a purchase order. */
export interface PoLineInput {
    /** The ordered item. */
    readonly itemId: string
    /** The ordered quantity. */
    readonly qty: number
    /** The unit cost. */
    readonly unitCost: number
}

/** The fields a supplier row is written with. */
export interface SupplierFields {
    /** The id of the supplier to change, or null for a new one. */
    readonly id: string | null
    /** The supplier name. */
    readonly name: string
    /** The contact person. */
    readonly contact: string
    /** The order email address. */
    readonly email: string | null
    /** The phone number. */
    readonly phone: string | null
    /** The Zalo contact. */
    readonly zalo: string | null
    /** How orders reach the supplier. */
    readonly channel: string
    /** The delivery time in days. */
    readonly leadTime: number
    /** The payment terms. */
    readonly terms: string
    /** A free note. */
    readonly note: string
}
