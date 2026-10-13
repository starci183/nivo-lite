import { CommandHandler } from "@nestjs/cqrs"
import { InventoryImportService } from "@modules/domain/inventory"
import type { ApplyStarterOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApplyInventoryStarterCommand } from "./apply-inventory-starter.command"

@CommandHandler(ApplyInventoryStarterCommand)
/** Load one starter set of suppliers, items and recipes. */
export class ApplyInventoryStarterHandler extends ICQRSHandler<ApplyInventoryStarterCommand, ApplyStarterOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly imports: InventoryImportService,
    ) {
        super(logger)
    }

    protected override process(command: ApplyInventoryStarterCommand): Promise<ApplyStarterOutput> {
        return this.imports.applyStarterKey(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.key,
        )
    }
}
