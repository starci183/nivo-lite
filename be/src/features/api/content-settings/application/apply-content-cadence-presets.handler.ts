import { CommandHandler } from "@nestjs/cqrs"
import { ContentConfigurationService, type SavedContentRows } from "@modules/domain/content-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ApplyContentCadencePresetsCommand } from "./apply-content-cadence-presets.command"

@CommandHandler(ApplyContentCadencePresetsCommand)
/** Delegates applyContentCadencePresets to the workspace configuration capability. */
export class ApplyContentCadencePresetsHandler extends ICQRSHandler<
    ApplyContentCadencePresetsCommand,
    SavedContentRows
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly configuration: ContentConfigurationService,
    ) {
        super(logger)
    }

    protected override process(command: ApplyContentCadencePresetsCommand): Promise<SavedContentRows> {
        return this.configuration.applyCadencePresets(command.params.principal.id, command.params.request.workspaceId)
    }
}
