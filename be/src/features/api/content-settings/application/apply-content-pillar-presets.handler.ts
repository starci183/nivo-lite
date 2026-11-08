import { CommandHandler } from "@nestjs/cqrs"
import { ContentConfigurationService, type SavedContentRows } from "@modules/domain/content-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ApplyContentPillarPresetsCommand } from "./apply-content-pillar-presets.command"

@CommandHandler(ApplyContentPillarPresetsCommand)
/** Delegates applyContentPillarPresets to the workspace configuration capability. */
export class ApplyContentPillarPresetsHandler extends ICQRSHandler<ApplyContentPillarPresetsCommand, SavedContentRows> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly configuration: ContentConfigurationService,
    ) {
        super(logger)
    }

    protected override process(command: ApplyContentPillarPresetsCommand): Promise<SavedContentRows> {
        return this.configuration.applyPillarPresets(command.params.principal.id, command.params.request.workspaceId)
    }
}
