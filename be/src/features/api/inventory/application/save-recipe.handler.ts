import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import type { SaveRecipeOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveRecipeCommand } from "./save-recipe.command"

@CommandHandler(SaveRecipeCommand)
/** Handles create or update one recipe through one domain-service call. */
export class SaveRecipeHandler extends ICQRSHandler<SaveRecipeCommand, SaveRecipeOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryCatalogService: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: SaveRecipeCommand): Promise<SaveRecipeOutput> {
        return this.inventoryCatalogService.saveRecipe(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
