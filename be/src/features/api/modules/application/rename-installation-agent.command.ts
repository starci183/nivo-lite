import { Command } from "@nestjs/cqrs"
import type { InstallationView } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RenameInstallationAgentRequest } from "./rename-installation-agent.contracts"

/** Asks to rename the agent of an installation. */
export class RenameInstallationAgentCommand extends Command<InstallationView> {
    constructor(readonly params: ExecuteParams<RenameInstallationAgentRequest>) {
        super()
    }
}
