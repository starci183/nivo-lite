import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveShiftsSettingsCommand } from "./save-shifts-settings.command"

@CommandHandler(SaveShiftsSettingsCommand)
/** Save the notice, reminder and overtime rules. */
export class SaveShiftsSettingsHandler extends ICQRSHandler<SaveShiftsSettingsCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveShiftsSettingsCommand): Promise<void> {
        return this.setup.saveSettings(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
