import type { SupplierFormValues } from "./inventory"
/** Holds editable item fields before an inventory item is saved. */
export interface InventoryItemFormData {
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
    readonly openingQty: string
}
/** InventoryItemEditorData resolved data. */
export interface InventoryItemEditorData {
    readonly copy: {
        readonly itemAddTitle: string
        readonly itemEditTitle: string
        readonly itemDrawerHint: string
        readonly close: string
        readonly itemName: string
        readonly itemSku: string
        readonly itemSkuHint: string
        readonly itemUnit: string
        readonly itemUnitHint: string
        readonly itemUnits: string
        readonly itemUnitsHint: string
        readonly itemCategory: string
        readonly itemSupplier: string
        readonly itemSupplierNone: string
        readonly itemCost: string
        readonly itemSell: string
        readonly itemReorderPoint: string
        readonly itemReorderPointHint: string
        readonly itemReorderQty: string
        readonly itemAliases: string
        readonly itemAliasesHint: string
        readonly itemOpening: string
        readonly save: string
        readonly itemStop: string
        readonly itemResume: string
    }
    readonly editing: string | null
    readonly active: boolean | null
    readonly values: InventoryItemFormData
    readonly suppliers: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly isPending: boolean
    readonly error: string | null
}
/** InventoryAdjustmentEditorData resolved data. */
export interface InventoryAdjustmentEditorData {
    readonly copy: {
        readonly adjustTitle: string
        readonly close: string
        readonly adjustMode: string
        readonly adjustFrom: string
        readonly adjustAt: string
        readonly adjustTo: string
        readonly adjustToHint: string
        readonly adjustNote: string
        readonly adjustReason: string
        readonly adjustReasonHint: string
        readonly valueLabel: string
    }
    readonly itemName: string
    readonly unit: string
    readonly summary: string
    readonly from: string
    readonly to: string
    readonly value: string
    readonly reason: string
    readonly submitLabel: string
    readonly modes: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly mode: "set" | "delta" | "move"
    readonly isMove: boolean
    readonly showPlaces: boolean
    readonly places: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly targets: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly preview: string | null
    readonly canSubmit: boolean
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
}
/** InventoryNewPoEditorData resolved data. */
export interface InventoryNewPoEditorData {
    readonly copy: {
        readonly newPoTitle: string
        readonly newPoHint: string
        readonly close: string
        readonly poSupplier: string
        readonly poSupplierHint: string
        readonly newPoItemHint: string
        readonly poQty: string
        readonly poUnitCost: string
        readonly newPoAddLine: string
        readonly newPoCreate: string
    }
    readonly supplierId: string
    readonly suppliers: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly items: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly lines: ReadonlyArray<{
        readonly key: string
        readonly itemId: string
        readonly qty: string
        readonly cost: string
        readonly itemLabel: string
    }>
    readonly isPending: boolean
    readonly error: string | null
}
/** InventoryPoEditorData resolved data. */
export interface InventoryPoEditorData {
    readonly copy: {
        readonly approveAndSend: string
        readonly close: string
        readonly poCancel: string
        readonly poCopied: string
        readonly poCopy: string
        readonly poExpected: string
        readonly poExpectedHint: string
        readonly poInvoice: string
        readonly poInvoiceHint: string
        readonly poItems: string
        readonly poMessageDrafted: string
        readonly poMessageHint: string
        readonly poQty: string
        readonly poReceive: string
        readonly poReceiveCost: string
        readonly poReceiveHint: string
        readonly poReceiveQty: string
        readonly poRemind: string
        readonly poSaveDraft: string
        readonly poSendForApproval: string
        readonly poSentEmail: string
        readonly poSupplier: string
        readonly poSupplierHint: string
        readonly poUnitCost: string
        readonly reject: string
    }
    readonly title: string
    readonly description: string
    readonly summary: string
    readonly supplierId: string
    readonly expected: string
    readonly total: string
    readonly invoiceNo: string
    readonly messageTitle: string
    readonly message: string
    readonly mode: "edit" | "read" | "receive"
    readonly suppliers: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly lines: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly hint: string
        readonly qty: string
        readonly cost: string
    }>
    readonly readLines: ReadonlyArray<{ readonly id: string; readonly text: string }>
    readonly messageEditable: boolean
    readonly sendNote: string | null
    readonly sentByEmail: boolean
    readonly canEdit: boolean
    readonly canApprove: boolean
    readonly canReceive: boolean
    readonly canCopy: boolean
    readonly canCancel: boolean
    readonly copied: boolean
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
}
/** InventorySupplierEditorData resolved data. */
export interface InventorySupplierEditorData {
    readonly copy: {
        readonly supplierAddTitle: string
        readonly supplierEditTitle: string
        readonly supplierDrawerHint: string
        readonly close: string
        readonly supplierName: string
        readonly supplierContact: string
        readonly supplierChannel: string
        readonly supplierEmail: string
        readonly supplierPhone: string
        readonly supplierZalo: string
        readonly supplierLead: string
        readonly supplierTerms: string
        readonly supplierNote: string
        readonly save: string
    }
    readonly editing: string | null
    readonly values: SupplierFormValues
    readonly channels: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly isPending: boolean
    readonly error: string | null
}
/** InventoryRecipeEditorData resolved data. */
export interface InventoryRecipeEditorData {
    readonly copy: {
        readonly recipeAddTitle: string
        readonly recipeEditTitle: string
        readonly recipeDrawerHint: string
        readonly close: string
        readonly recipeName: string
        readonly recipeNameHint: string
        readonly recipeAliases: string
        readonly recipeAliasesHint: string
        readonly recipeIngredients: string
        readonly recipeIngredientHint: string
        readonly recipeRemoveLine: string
        readonly recipeAddLine: string
        readonly save: string
        readonly recipeDelete: string
    }
    readonly editing: string | null
    readonly name: string
    readonly aliases: string
    readonly lines: ReadonlyArray<{
        readonly key: string
        readonly itemId: string
        readonly qty: string
        readonly ingredientLabel: string
        readonly quantityLabel: string
        readonly unit: string
    }>
    readonly items: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly isPending: boolean
    readonly error: string | null
}
