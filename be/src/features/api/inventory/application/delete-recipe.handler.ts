import { CommandHandler } from "@nestjs/cqrs"
import { InventoryCatalogService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteRecipeCommand } from "./delete-recipe.command"

@CommandHandler(DeleteRecipeCommand)
/** Handles delete one recipe through one domain-service call. */
export class DeleteRecipeHandler extends ICQRSHandler<DeleteRecipeCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryCatalogService: InventoryCatalogService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteRecipeCommand): Promise<void> {
        return this.inventoryCatalogService.deleteRecipe(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
