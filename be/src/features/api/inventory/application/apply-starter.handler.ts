import { CommandHandler } from "@nestjs/cqrs"
import { InventoryImportService } from "@modules/domain/inventory"
import type { ApplyStarterOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApplyStarterCommand } from "./apply-starter.command"

@CommandHandler(ApplyStarterCommand)
/** Handles load a starter set of suppliers, items and recipes through one domain-service call. */
export class ApplyStarterHandler extends ICQRSHandler<ApplyStarterCommand, ApplyStarterOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryImportService: InventoryImportService,
    ) {
        super(logger)
    }

    protected override process(command: ApplyStarterCommand): Promise<ApplyStarterOutput> {
        return this.inventoryImportService.applyStarter(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
