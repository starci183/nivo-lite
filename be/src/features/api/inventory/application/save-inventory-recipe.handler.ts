import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import type { SaveRecipeOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveInventoryRecipeCommand } from "./save-inventory-recipe.command"

@CommandHandler(SaveInventoryRecipeCommand)
/** Create or update one recipe. */
export class SaveInventoryRecipeHandler extends ICQRSHandler<SaveInventoryRecipeCommand, SaveRecipeOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly catalog: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: SaveInventoryRecipeCommand): Promise<SaveRecipeOutput> {
        return this.catalog.saveRecipe(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
