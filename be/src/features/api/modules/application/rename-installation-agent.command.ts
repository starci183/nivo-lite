import { Command } from "@nestjs/cqrs"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RenameInstallationAgentRequest } from "./rename-installation-agent.contracts"

/** Asks to rename the agent of an installation. */
export class RenameInstallationAgentCommand extends Command<InstallationRecord> {
    constructor(readonly params: ExecuteParams<RenameInstallationAgentRequest>) {
        super()
    }
}
