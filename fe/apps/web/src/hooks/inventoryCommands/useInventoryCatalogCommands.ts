import { useMemo } from "react"
import {
    useMutateDeleteInventoryRecipeSwr,
    useMutateSaveInventoryItemSwr,
    useMutateSaveInventoryLocationSwr,
    useMutateSaveInventoryRecipeSwr,
    useMutateSaveInventorySupplierSwr,
    useMutateSetInventoryItemActiveSwr,
} from "@/hooks/swr"
import type { InventoryCatalogCommands } from "./inventoryCommands.shared"

/** The catalogue commands of the inventory workbench (items, suppliers, recipes, locations) through the back end GraphQL door. */
export const useInventoryCatalogCommands = (): InventoryCatalogCommands => {
    const { trigger: saveItemTrigger } = useMutateSaveInventoryItemSwr()
    const { trigger: setItemActiveTrigger } = useMutateSetInventoryItemActiveSwr()
    const { trigger: saveSupplierTrigger } = useMutateSaveInventorySupplierSwr()
    const { trigger: saveRecipeTrigger } = useMutateSaveInventoryRecipeSwr()
    const { trigger: deleteRecipeTrigger } = useMutateDeleteInventoryRecipeSwr()
    const { trigger: saveLocationTrigger } = useMutateSaveInventoryLocationSwr()
    return useMemo<InventoryCatalogCommands>(
        () => ({
            saveItem: (input) => saveItemTrigger(input),
            setItemActive: async (id, active) => {
                await setItemActiveTrigger({ id, active })
                return null
            },
            saveSupplier: (input) => saveSupplierTrigger(input),
            saveRecipe: async (input) => saveRecipeTrigger({ ...input, lines: [...input.lines] }),
            deleteRecipe: async (id) => {
                await deleteRecipeTrigger({ id })
                return null
            },
            saveLocation: async (name) => {
                await saveLocationTrigger({ name })
                return null
            },
        }),
        [
            saveItemTrigger,
            setItemActiveTrigger,
            saveSupplierTrigger,
            saveRecipeTrigger,
            deleteRecipeTrigger,
            saveLocationTrigger,
        ],
    )
}
