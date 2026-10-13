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
    StarterItem,
    StockTakeItem,
    SupplierInput,
    TransferInput,
} from "@/modules/types"

/** The catalogue commands: each answers its typed value and rejects with the failure the back end sent. */
export interface InventoryCatalogCommands {
    readonly saveItem: (input: ItemInput) => Promise<SavedItem>
    readonly setItemActive: (id: string, active: boolean) => Promise<null>
    readonly saveSupplier: (input: SupplierInput) => Promise<SavedItem>
    readonly saveRecipe: (input: RecipeInput) => Promise<SavedItem>
    readonly deleteRecipe: (id: string) => Promise<null>
    readonly saveLocation: (name: string) => Promise<null>
}

/** The stock commands: import, starter, adjust, count, transfer and the low-stock draft. */
export interface InventoryStockCommands {
    readonly importPaste: (raw: string) => Promise<ImportItem>
    readonly applyStarter: (key: string) => Promise<StarterItem>
    readonly adjustStock: (input: AdjustInput) => Promise<AdjustItem>
    readonly stockTake: (counts: ReadonlyArray<CountInput>) => Promise<StockTakeItem>
    readonly transferStock: (input: TransferInput) => Promise<null>
    readonly draftLowStock: () => Promise<DraftLowItem>
}

/** The purchase order commands. */
export interface InventoryOrderCommands {
    readonly createPo: (input: NewPoInput) => Promise<SavedItem>
    readonly updatePoDraft: (input: DraftPoInput) => Promise<null>
    readonly requestSend: (poId: string, kind: "order" | "reminder") => Promise<SendItem>
    readonly cancelPo: (poId: string) => Promise<null>
    readonly receivePo: (input: ReceiveInput) => Promise<ReceiveItem>
}

/** Every command of the inventory screens. The caller (`useInventoryRun`) toasts the outcome and revalidates the workbench read. */
export type InventoryCommands = InventoryCatalogCommands & InventoryStockCommands & InventoryOrderCommands

/** The commands one panel needs. */
export type InventoryCommandSet<Name extends keyof InventoryCommands> = Pick<InventoryCommands, Name>

/** The line groups the contract takes: `[[line]]` per line today, `[line]` once the back end flattens the lists. */
export const lineGroups = <Line>(lines: ReadonlyArray<Line>): Array<Array<Line>> => lines.map((line) => [line])
