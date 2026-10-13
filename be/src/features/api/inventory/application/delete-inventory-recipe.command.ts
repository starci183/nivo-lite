import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteInventoryRecipeRequest } from "./delete-inventory-recipe.contracts"

/** Asks for delete one recipe. */
export class DeleteInventoryRecipeCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DeleteInventoryRecipeRequest>) {
        super()
    }
}
