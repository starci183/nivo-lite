import { CommandHandler } from "@nestjs/cqrs"
import { ContentConfigurationService } from "@modules/domain/content-settings"
import type { SavedContentRows } from "@modules/domain/content-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveContentCadenceCommand } from "./save-content-cadence.command"

@CommandHandler(SaveContentCadenceCommand)
/** Delegates saveContentCadence to the workspace configuration capability. */
export class SaveContentCadenceHandler extends ICQRSHandler<SaveContentCadenceCommand, SavedContentRows> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly configuration: ContentConfigurationService,
    ) {
        super(logger)
    }

    protected override process(command: SaveContentCadenceCommand): Promise<SavedContentRows> {
        return this.configuration.saveCadence(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.rows,
        )
    }
}
