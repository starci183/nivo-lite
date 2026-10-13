import type { DbOutcome } from "@/modules/db"
import type { Json } from "../../../../../../supabase/types/database.types"
import type {
    AdjustInput,
    AdjustItem,
    CountInput,
    DraftLowItem,
    DraftPoInput,
    ImportItem,
    ItemInput,
    NewPoInput,
    ReceiveInput,
    ReceiveItem,
    RecipeInput,
    SavedItem,
    SendItem,
    StarterInput,
    StarterItem,
    StockTakeItem,
    SupplierInput,
    TransferInput,
} from "@/modules/types"

/** The result vocabulary of the commands: the database transport's own; a failure code is the sentence the back end refused with. */
export type InventoryResult<Value> = DbOutcome<Value>

/** The one Server Action that submits a command and waits for its answer, handed in by the connected block. */
export type InventorySend = (workspaceId: string, kind: string, input: Json) => Promise<InventoryResult<Json>>

/** The commands of the inventory screens, each typed to what it takes and answers. */
export interface InventoryCommands {
    readonly saveItem: (input: ItemInput) => Promise<InventoryResult<SavedItem>>
    readonly setItemActive: (id: string, active: boolean) => Promise<InventoryResult<null>>
    readonly saveSupplier: (input: SupplierInput) => Promise<InventoryResult<SavedItem>>
    readonly saveRecipe: (input: RecipeInput) => Promise<InventoryResult<SavedItem>>
    readonly deleteRecipe: (id: string) => Promise<InventoryResult<null>>
    readonly saveLocation: (name: string) => Promise<InventoryResult<null>>
    readonly importPaste: (raw: string) => Promise<InventoryResult<ImportItem>>
    readonly applyStarter: (input: StarterInput) => Promise<InventoryResult<StarterItem>>
    readonly adjustStock: (input: AdjustInput) => Promise<InventoryResult<AdjustItem>>
    readonly stockTake: (counts: ReadonlyArray<CountInput>) => Promise<InventoryResult<StockTakeItem>>
    readonly transferStock: (input: TransferInput) => Promise<InventoryResult<null>>
    readonly draftLowStock: () => Promise<InventoryResult<DraftLowItem>>
    readonly createPo: (input: NewPoInput) => Promise<InventoryResult<SavedItem>>
    readonly updatePoDraft: (input: DraftPoInput) => Promise<InventoryResult<null>>
    readonly requestSend: (poId: string, kind: "order" | "reminder") => Promise<InventoryResult<SendItem>>
    readonly cancelPo: (poId: string) => Promise<InventoryResult<null>>
    readonly receivePo: (input: ReceiveInput) => Promise<InventoryResult<ReceiveItem>>
}

/** The commands one panel needs. */
export type InventoryCommandSet<Name extends keyof InventoryCommands> = Pick<InventoryCommands, Name>

const isRecord = (value: Json | undefined): value is { [key: string]: Json | undefined } =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isCount = (value: Json | undefined): value is number => typeof value === "number" && Number.isFinite(value)

const isTexts = (value: Json | undefined): value is Array<string> =>
    Array.isArray(value) && value.every((entry) => typeof entry === "string")

/** A decoder of one command answer: the typed value, or nothing when the answer has another shape. */
type Decoder<Value> = (value: Json) => Value | undefined

const decodeSaved: Decoder<SavedItem> = (value) =>
    isRecord(value) && typeof value.id === "string" ? { id: value.id } : undefined

const decodeAdjust: Decoder<AdjustItem> = (value) =>
    isRecord(value) && (value.state === "applied" || value.state === "waiting") ? { state: value.state } : undefined

const decodeStockTake: Decoder<StockTakeItem> = (value) =>
    isRecord(value) && isCount(value.applied) && isCount(value.waiting) && isCount(value.same)
        ? { applied: value.applied, waiting: value.waiting, same: value.same }
        : undefined

const decodeImport: Decoder<ImportItem> = (value) =>
    isRecord(value) &&
    isCount(value.created) &&
    isCount(value.updated) &&
    isCount(value.stocked) &&
    isTexts(value.skipped)
        ? { created: value.created, updated: value.updated, stocked: value.stocked, skipped: value.skipped }
        : undefined

const decodeStarter: Decoder<StarterItem> = (value) =>
    isRecord(value) && isCount(value.items) && isCount(value.suppliers) && isCount(value.recipes)
        ? { items: value.items, suppliers: value.suppliers, recipes: value.recipes }
        : undefined

const decodeDraftLow: Decoder<DraftLowItem> = (value) =>
    isRecord(value) && isCount(value.drafted) && isCount(value.low)
        ? { drafted: value.drafted, low: value.low }
        : undefined

const decodeSend: Decoder<SendItem> = (value) =>
    isRecord(value) && typeof value.status === "string" ? { status: value.status } : undefined

const decodeReceive: Decoder<ReceiveItem> = (value) =>
    isRecord(value) &&
    (value.status === "partially_received" || value.status === "received") &&
    isTexts(value.priceChanges) &&
    typeof value.handedToAccounting === "boolean"
        ? { status: value.status, priceChanges: value.priceChanges, handedToAccounting: value.handedToAccounting }
        : undefined

/** The decoders of the commands that answer something, by command. */
export const DECODERS = {
    saved: decodeSaved,
    adjust: decodeAdjust,
    stockTake: decodeStockTake,
    importPaste: decodeImport,
    starter: decodeStarter,
    draftLow: decodeDraftLow,
    send: decodeSend,
    receive: decodeReceive,
}

/** Decodes the answer of a command; an answer of another shape is an unavailable failure. */
export const decoded = <Value>(result: InventoryResult<Json>, decode: Decoder<Value>): InventoryResult<Value> => {
    if (result.kind !== "ok") return result
    const value = decode(result.value)
    return value === undefined ? { kind: "unavailable", code: "shape" } : { kind: "ok", value }
}

/** The answer of a command that answers nothing. */
export const nothing = (result: InventoryResult<Json>): InventoryResult<null> =>
    result.kind === "ok" ? { kind: "ok", value: null } : result

/** The starter set as plain JSON, the form the command row stores. */
export const starterJson = (input: StarterInput): Json => ({
    name: input.name,
    suppliers: input.suppliers.map((supplier) => ({ ...supplier })),
    items: input.items.map((item) => ({
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        category: item.category,
        costVnd: item.costVnd,
        sellPriceVnd: item.sellPriceVnd,
        reorderPoint: item.reorderPoint,
        reorderQty: item.reorderQty,
        supplier: item.supplier,
        qty: item.qty,
        units: item.units?.map((unit) => ({ ...unit })),
        aliases: item.aliases === undefined ? undefined : [...item.aliases],
    })),
    recipes: input.recipes.map((recipe) => ({
        name: recipe.name,
        aliases: recipe.aliases === undefined ? undefined : [...recipe.aliases],
        lines: recipe.lines.map((line) => ({ ...line })),
    })),
})
