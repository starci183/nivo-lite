import type { ApplyStarterOutput, ImportPasteOutput } from "@modules/domain/inventory"
import type { ApplyInventoryStarterRequest } from "../../application/apply-inventory-starter.contracts"
import type { ImportInventoryPasteRequest } from "../../application/import-inventory-paste.contracts"
import type { ApplyInventoryStarterInput } from "./dto/apply-inventory-starter.input"
import type { ApplyStarterType } from "./dto/apply-starter.type"
import type { ImportInventoryPasteInput } from "./dto/import-inventory-paste.input"
import type { ImportPasteType } from "./dto/import-paste.type"

/** Maps the GraphQL input to the paste import request of the workspace it names. */
export const toImportInventoryPasteRequest = (
    workspaceId: string,
    input: ImportInventoryPasteInput,
): ImportInventoryPasteRequest => ({ workspaceId, raw: input.raw })

/** Maps the GraphQL input to the starter apply request of the workspace it names. */
export const toApplyInventoryStarterRequest = (
    workspaceId: string,
    input: ApplyInventoryStarterInput,
): ApplyInventoryStarterRequest => ({ workspaceId, key: input.key })

/** Maps the paste import outcome to the GraphQL type. */
export const toImportPasteType = (result: ImportPasteOutput): ImportPasteType => ({
    created: result.created,
    updated: result.updated,
    stocked: result.stocked,
    skipped: [...result.skipped],
})

/** Maps the starter apply outcome to the GraphQL type. */
export const toApplyStarterType = (result: ApplyStarterOutput): ApplyStarterType => ({
    items: result.items,
    suppliers: result.suppliers,
    recipes: result.recipes,
})
