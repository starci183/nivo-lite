import { Command } from "@nestjs/cqrs"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RenameInstallationRequest } from "./rename-installation.contracts"

/** Asks to rename an instance: its label in lists, the chrome and Office. */
export class RenameInstallationCommand extends Command<InstallationRecord> {
    constructor(readonly params: ExecuteParams<RenameInstallationRequest>) {
        super()
    }
}
