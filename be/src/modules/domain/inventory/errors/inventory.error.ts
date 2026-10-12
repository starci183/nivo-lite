import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the inventory capability. */
export enum InventoryErrorCode {
    /** No item of the workspace has the requested id. */
    ItemNotFound = "INVENTORY_ITEM_NOT_FOUND",
    /** The item name is empty. */
    ItemNameRequired = "INVENTORY_ITEM_NAME_REQUIRED",
    /** Another item of the workspace already has the code. */
    ItemSkuTaken = "INVENTORY_ITEM_SKU_TAKEN",
    /** The supplier name is empty. */
    SupplierNameRequired = "INVENTORY_SUPPLIER_NAME_REQUIRED",
    /** The supplier email is not shaped like an address. */
    SupplierEmailInvalid = "INVENTORY_SUPPLIER_EMAIL_INVALID",
    /** The supplier does not exist in the workspace. */
    SupplierNotFound = "INVENTORY_SUPPLIER_NOT_FOUND",
    /** The recipe name is empty. */
    RecipeNameRequired = "INVENTORY_RECIPE_NAME_REQUIRED",
    /** The recipe has no ingredient with a quantity. */
    RecipeLinesRequired = "INVENTORY_RECIPE_LINES_REQUIRED",
    /** The recipe does not exist in the workspace. */
    RecipeNotFound = "INVENTORY_RECIPE_NOT_FOUND",
    /** The location name is empty. */
    LocationNameRequired = "INVENTORY_LOCATION_NAME_REQUIRED",
    /** A named location does not exist in the workspace. */
    LocationNotFound = "INVENTORY_LOCATION_NOT_FOUND",
    /** The default location could not be created or read. */
    LocationNotCreated = "INVENTORY_LOCATION_NOT_CREATED",
    /** The movement function answered nothing. */
    MovementNotApplied = "INVENTORY_MOVEMENT_NOT_APPLIED",
    /** A transfer needs two different locations. */
    TransferSameLocation = "INVENTORY_TRANSFER_SAME_LOCATION",
    /** A transfer needs a positive quantity. */
    TransferQtyRequired = "INVENTORY_TRANSFER_QTY_REQUIRED",
    /** A stock count has no usable line. */
    CountEmpty = "INVENTORY_COUNT_EMPTY",
    /** A stock adjustment names neither a change nor a count. */
    AdjustQtyRequired = "INVENTORY_ADJUST_QTY_REQUIRED",
    /** The pasted table has no row with a name. */
    ImportEmpty = "INVENTORY_IMPORT_EMPTY",
    /** The purchase order does not exist in the workspace. */
    PoNotFound = "INVENTORY_PO_NOT_FOUND",
    /** A purchase order needs at least one item with a quantity. */
    PoLinesRequired = "INVENTORY_PO_LINES_REQUIRED",
    /** A unique purchase order number could not be found. */
    PoNumberUnavailable = "INVENTORY_PO_NUMBER_UNAVAILABLE",
    /** Only a draft order can be edited. */
    PoNotDraft = "INVENTORY_PO_NOT_DRAFT",
    /** The order has no supplier chosen. */
    PoSupplierRequired = "INVENTORY_PO_SUPPLIER_REQUIRED",
    /** The order has no lines. */
    PoEmpty = "INVENTORY_PO_EMPTY",
    /** The order has not been sent, so nothing can be received. */
    PoNotReceivable = "INVENTORY_PO_NOT_RECEIVABLE",
    /** The receipt names no quantity. */
    ReceiptEmpty = "INVENTORY_RECEIPT_EMPTY",
    /** The order can no longer be cancelled. */
    PoNotCancellable = "INVENTORY_PO_NOT_CANCELLABLE",
    /** The order has no message to send. */
    PoMessageEmpty = "INVENTORY_PO_MESSAGE_EMPTY",
}

/** How each inventory code travels. */
export const INVENTORY_ERROR_KINDS: Record<InventoryErrorCode, ErrorKind> = {
    [InventoryErrorCode.ItemNotFound]: "not-found",
    [InventoryErrorCode.ItemNameRequired]: "invalid",
    [InventoryErrorCode.ItemSkuTaken]: "conflict",
    [InventoryErrorCode.SupplierNameRequired]: "invalid",
    [InventoryErrorCode.SupplierEmailInvalid]: "invalid",
    [InventoryErrorCode.SupplierNotFound]: "not-found",
    [InventoryErrorCode.RecipeNameRequired]: "invalid",
    [InventoryErrorCode.RecipeLinesRequired]: "invalid",
    [InventoryErrorCode.RecipeNotFound]: "not-found",
    [InventoryErrorCode.LocationNameRequired]: "invalid",
    [InventoryErrorCode.LocationNotFound]: "not-found",
    [InventoryErrorCode.LocationNotCreated]: "internal",
    [InventoryErrorCode.MovementNotApplied]: "internal",
    [InventoryErrorCode.TransferSameLocation]: "invalid",
    [InventoryErrorCode.TransferQtyRequired]: "invalid",
    [InventoryErrorCode.CountEmpty]: "invalid",
    [InventoryErrorCode.AdjustQtyRequired]: "invalid",
    [InventoryErrorCode.ImportEmpty]: "invalid",
    [InventoryErrorCode.PoNotFound]: "not-found",
    [InventoryErrorCode.PoLinesRequired]: "invalid",
    [InventoryErrorCode.PoNumberUnavailable]: "conflict",
    [InventoryErrorCode.PoNotDraft]: "conflict",
    [InventoryErrorCode.PoSupplierRequired]: "invalid",
    [InventoryErrorCode.PoEmpty]: "invalid",
    [InventoryErrorCode.PoNotReceivable]: "conflict",
    [InventoryErrorCode.ReceiptEmpty]: "invalid",
    [InventoryErrorCode.PoNotCancellable]: "conflict",
    [InventoryErrorCode.PoMessageEmpty]: "invalid",
}

/** The one error class of the inventory capability. */
export class InventoryError extends DomainError<InventoryErrorCode> {}
