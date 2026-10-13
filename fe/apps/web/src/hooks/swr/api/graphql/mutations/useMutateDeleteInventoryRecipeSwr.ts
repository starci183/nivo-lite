import useSWRMutation from "swr/mutation"
import { mutateDeleteInventoryRecipe } from "@/modules/api/graphql/mutations/mutation-delete-inventory-recipe"
import type { MutateDeleteInventoryRecipeRequest } from "@/modules/api/graphql/mutations/mutation-delete-inventory-recipe"

/** What the deleteInventoryRecipe mutation is triggered with. */
interface DeleteInventoryRecipeArg {
    readonly arg: MutateDeleteInventoryRecipeRequest
}

/** The SWR key of the `deleteInventoryRecipe` mutation. */
export const MUTATE_DELETE_INVENTORY_RECIPE_SWR_KEY = "MUTATE_DELETE_INVENTORY_RECIPE_SWR"

/** SWR mutation for {@link mutateDeleteInventoryRecipe}: `trigger(request)` answers `deleteInventoryRecipe` and rejects with the back end failure. */
export const useMutateDeleteInventoryRecipeSwr = () =>
    useSWRMutation(MUTATE_DELETE_INVENTORY_RECIPE_SWR_KEY, async (_key: string, { arg }: DeleteInventoryRecipeArg) => {
        const result = await mutateDeleteInventoryRecipe({ request: arg })
        if (!result.data) throw new Error("deleteInventoryRecipe answered no data")
        return result.data.deleteInventoryRecipe
    })
