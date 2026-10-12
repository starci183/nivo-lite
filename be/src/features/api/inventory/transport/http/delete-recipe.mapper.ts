import type { DeleteRecipeRequest } from "../../application/delete-recipe.contracts"
import type { DeleteRecipeRequest as DeleteRecipeHttpRequest } from "./dto/delete-recipe.request"

/** Maps the HTTP request to the delete-recipe request. */
export const toDeleteRecipeRequest = (input: DeleteRecipeHttpRequest, workspaceId: string): DeleteRecipeRequest => ({
    workspaceId,
    input: {
        id: input.id,
    },
})
