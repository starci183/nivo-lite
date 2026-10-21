import { Command } from "@nestjs/cqrs"
import type { InstallationView } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RenameInstallationRequest } from "./rename-installation.contracts"

/** Asks to rename an instance: its label in lists, the chrome and Office. */
export class RenameInstallationCommand extends Command<InstallationView> {
    constructor(readonly params: ExecuteParams<RenameInstallationRequest>) {
        super()
    }
}
