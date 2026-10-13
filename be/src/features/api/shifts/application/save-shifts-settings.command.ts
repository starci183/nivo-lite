import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveShiftsSettingsRequest } from "./save-shifts-settings.contracts"

/** Asks for save the notice, reminder and overtime rules. */
export class SaveShiftsSettingsCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SaveShiftsSettingsRequest>) {
        super()
    }
}
