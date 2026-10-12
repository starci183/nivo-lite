import type { SaveRecipeRequest } from "../../application/save-recipe.contracts"
import type { SaveRecipeOutput } from "@modules/domain/inventory"
import type { SaveRecipeRequest as SaveRecipeHttpRequest } from "./dto/save-recipe.request"
import type { SaveRecipeResponse } from "./dto/save-recipe.response"

/** Maps the HTTP request to the save-recipe request. */
export const toSaveRecipeRequest = (input: SaveRecipeHttpRequest, workspaceId: string): SaveRecipeRequest => ({
    workspaceId,
    input: {
        id: input.id,
        name: input.name,
        aliases: input.aliases,
        lines: input.lines.map((item) => ({ itemId: item.itemId, qty: item.qty })),
    },
})

/** Maps the save-recipe result to the HTTP response. */
export const toSaveRecipeResponse = (result: SaveRecipeOutput): SaveRecipeResponse => ({
    id: result.id,
})
