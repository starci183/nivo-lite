import { Command } from "@nestjs/cqrs"
import type { EnsureSettingsOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveHiringSettingsRequest } from "./save-hiring-settings.contracts"

/** Asks for change the hiring settings. */
export class SaveHiringSettingsCommand extends Command<EnsureSettingsOutput> {
    constructor(readonly params: ExecuteParams<SaveHiringSettingsRequest>) {
        super()
    }
}
