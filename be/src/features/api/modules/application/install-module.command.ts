import { Command } from "@nestjs/cqrs"
import type { InstallResult } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { InstallModuleRequest } from "./install-module.contracts"

/** Asks to install a module, or to add an instance of a multi-instance type. */
export class InstallModuleCommand extends Command<InstallResult> {
    constructor(readonly params: ExecuteParams<InstallModuleRequest>) {
        super()
    }
}
