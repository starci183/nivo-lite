import type { SaveItemOutput, SaveRecipeOutput, SaveSupplierOutput } from "@modules/domain/inventory"
import type { DeleteInventoryRecipeRequest } from "../../application/delete-inventory-recipe.contracts"
import type { SaveInventoryItemRequest } from "../../application/save-inventory-item.contracts"
import type { SaveInventoryLocationRequest } from "../../application/save-inventory-location.contracts"
import type { SaveInventoryRecipeRequest } from "../../application/save-inventory-recipe.contracts"
import type { SaveInventorySupplierRequest } from "../../application/save-inventory-supplier.contracts"
import type { SetInventoryItemActiveRequest } from "../../application/set-inventory-item-active.contracts"
import type { InventoryRecipeRefInput } from "./dto/inventory-recipe-ref.input"
import type { InventoryRefType } from "./dto/inventory-ref.type"
import type { SaveInventoryItemInput } from "./dto/save-inventory-item.input"
import type { SaveInventoryLocationInput } from "./dto/save-inventory-location.input"
import type { SaveInventoryRecipeInput } from "./dto/save-inventory-recipe.input"
import type { SaveInventorySupplierInput } from "./dto/save-inventory-supplier.input"
import type { SetInventoryItemActiveInput } from "./dto/set-inventory-item-active.input"

/** Maps the GraphQL input to the item save request of the workspace it names. */
export const toSaveInventoryItemRequest = (
    workspaceId: string,
    input: SaveInventoryItemInput,
): SaveInventoryItemRequest => ({
    workspaceId,
    ...input,
})

/** Maps the GraphQL input to the item activation request of the workspace it names. */
export const toSetInventoryItemActiveRequest = (
    workspaceId: string,
    input: SetInventoryItemActiveInput,
): SetInventoryItemActiveRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the supplier save request of the workspace it names. */
export const toSaveInventorySupplierRequest = (
    workspaceId: string,
    input: SaveInventorySupplierInput,
): SaveInventorySupplierRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the recipe save request of the workspace it names. */
export const toSaveInventoryRecipeRequest = (
    workspaceId: string,
    input: SaveInventoryRecipeInput,
): SaveInventoryRecipeRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the recipe delete request of the workspace it names. */
export const toDeleteInventoryRecipeRequest = (
    workspaceId: string,
    input: InventoryRecipeRefInput,
): DeleteInventoryRecipeRequest => ({ workspaceId, id: input.id })

/** Maps the GraphQL input to the location save request of the workspace it names. */
export const toSaveInventoryLocationRequest = (
    workspaceId: string,
    input: SaveInventoryLocationInput,
): SaveInventoryLocationRequest => ({ workspaceId, ...input })

/** Maps an id answer to the GraphQL type. */
export const toInventoryRefType = (
    result: SaveItemOutput | SaveSupplierOutput | SaveRecipeOutput,
): InventoryRefType => ({
    id: result.id,
})
