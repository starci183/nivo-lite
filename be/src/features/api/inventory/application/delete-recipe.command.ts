import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteRecipeRequest } from "./delete-recipe.contracts"

/** Asks to delete one recipe. */
export class DeleteRecipeCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DeleteRecipeRequest>) {
        super()
    }
}
