import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteInventoryRecipeCommand } from "./delete-inventory-recipe.command"

@CommandHandler(DeleteInventoryRecipeCommand)
/** Delete one recipe. */
export class DeleteInventoryRecipeHandler extends ICQRSHandler<DeleteInventoryRecipeCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly catalog: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteInventoryRecipeCommand): Promise<void> {
        return this.catalog.deleteRecipe(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
