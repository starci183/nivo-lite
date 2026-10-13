import { useMemo } from "react"
import { useMutateDeleteInventoryRecipeSwr } from "@/hooks/swr/api/graphql/mutations/useMutateDeleteInventoryRecipeSwr"
import { useMutateSaveInventoryItemSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveInventoryItemSwr"
import { useMutateSaveInventoryLocationSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveInventoryLocationSwr"
import { useMutateSaveInventoryRecipeSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveInventoryRecipeSwr"
import { useMutateSaveInventorySupplierSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveInventorySupplierSwr"
import { useMutateSetInventoryItemActiveSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSetInventoryItemActiveSwr"
import type { InventoryCatalogCommands } from "./inventoryCommands.shared"
import { lineGroups } from "./inventoryCommands.shared"

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
            saveRecipe: async (input) => saveRecipeTrigger({ ...input, lines: lineGroups(input.lines) }),
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
