import { Command } from "@nestjs/cqrs"
import type { SaveRecipeOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveRecipeRequest } from "./save-recipe.contracts"

/** Asks to create or update one recipe. */
export class SaveRecipeCommand extends Command<SaveRecipeOutput> {
    constructor(readonly params: ExecuteParams<SaveRecipeRequest>) {
        super()
    }
}
