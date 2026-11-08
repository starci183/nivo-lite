import { CommandHandler } from "@nestjs/cqrs"
import { ContentConfigurationService, type SavedContentRows } from "@modules/domain/content-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SaveContentPillarsCommand } from "./save-content-pillars.command"

@CommandHandler(SaveContentPillarsCommand)
/** Delegates saveContentPillars to the workspace configuration capability. */
export class SaveContentPillarsHandler extends ICQRSHandler<SaveContentPillarsCommand, SavedContentRows> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly configuration: ContentConfigurationService,
    ) {
        super(logger)
    }

    protected override process(command: SaveContentPillarsCommand): Promise<SavedContentRows> {
        return this.configuration.savePillars(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.rows,
        )
    }
}
