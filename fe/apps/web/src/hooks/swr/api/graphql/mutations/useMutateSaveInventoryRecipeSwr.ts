import useSWRMutation from "swr/mutation"
import { mutateSaveInventoryRecipe } from "@/modules/api/graphql/mutations/mutation-save-inventory-recipe"
import type { MutateSaveInventoryRecipeRequest } from "@/modules/api/graphql/mutations/mutation-save-inventory-recipe"

/** What the saveInventoryRecipe mutation is triggered with. */
interface SaveInventoryRecipeArg {
    readonly arg: MutateSaveInventoryRecipeRequest
}

/** The SWR key of the `saveInventoryRecipe` mutation. */
export const MUTATE_SAVE_INVENTORY_RECIPE_SWR_KEY = "MUTATE_SAVE_INVENTORY_RECIPE_SWR"

/** SWR mutation for {@link mutateSaveInventoryRecipe}: `trigger(request)` answers `saveInventoryRecipe` and rejects with the back end failure. */
export const useMutateSaveInventoryRecipeSwr = () =>
    useSWRMutation(MUTATE_SAVE_INVENTORY_RECIPE_SWR_KEY, async (_key: string, { arg }: SaveInventoryRecipeArg) => {
        const result = await mutateSaveInventoryRecipe({ request: arg })
        if (!result.data) throw new Error("saveInventoryRecipe answered no data")
        return result.data.saveInventoryRecipe
    })
