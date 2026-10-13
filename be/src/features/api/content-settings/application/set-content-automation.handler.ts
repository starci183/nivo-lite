import { CommandHandler } from "@nestjs/cqrs"
import { ContentConfigurationService } from "@modules/domain/content-settings"
import type { ContentBrandSettings } from "@modules/domain/content-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetContentAutomationCommand } from "./set-content-automation.command"

@CommandHandler(SetContentAutomationCommand)
/** Delegates setContentAutomation to the workspace configuration capability. */
export class SetContentAutomationHandler extends ICQRSHandler<SetContentAutomationCommand, ContentBrandSettings> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly configuration: ContentConfigurationService,
    ) {
        super(logger)
    }

    protected override process(command: SetContentAutomationCommand): Promise<ContentBrandSettings> {
        return this.configuration.setAutomation(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.key,
            command.params.request.on,
        )
    }
}
