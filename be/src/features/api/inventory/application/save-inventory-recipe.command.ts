import { Command } from "@nestjs/cqrs"
import type { SaveRecipeOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveInventoryRecipeRequest } from "./save-inventory-recipe.contracts"

/** Asks for create or update one recipe. */
export class SaveInventoryRecipeCommand extends Command<SaveRecipeOutput> {
    constructor(readonly params: ExecuteParams<SaveInventoryRecipeRequest>) {
        super()
    }
}
