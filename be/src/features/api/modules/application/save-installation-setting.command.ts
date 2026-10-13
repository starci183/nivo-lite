import { Command } from "@nestjs/cqrs"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveInstallationSettingRequest } from "./save-installation-setting.contracts"

/** Asks to merge one setting into the settings of an installation. */
export class SaveInstallationSettingCommand extends Command<InstallationRecord> {
    constructor(readonly params: ExecuteParams<SaveInstallationSettingRequest>) {
        super()
    }
}
