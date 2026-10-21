import { Command } from "@nestjs/cqrs"
import type { InstallationView } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveInstallationSettingRequest } from "./save-installation-setting.contracts"

/** Asks to merge one setting into the settings of an installation. */
export class SaveInstallationSettingCommand extends Command<InstallationView> {
    constructor(readonly params: ExecuteParams<SaveInstallationSettingRequest>) {
        super()
    }
}
