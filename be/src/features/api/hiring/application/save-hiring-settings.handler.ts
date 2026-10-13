import { CommandHandler } from "@nestjs/cqrs"
import { HiringSettingsService } from "@modules/domain/hiring"
import type { EnsureSettingsOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveHiringSettingsCommand } from "./save-hiring-settings.command"

@CommandHandler(SaveHiringSettingsCommand)
/** Change the hiring settings. */
export class SaveHiringSettingsHandler extends ICQRSHandler<SaveHiringSettingsCommand, EnsureSettingsOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly settings: HiringSettingsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveHiringSettingsCommand): Promise<EnsureSettingsOutput> {
        return this.settings.save(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
