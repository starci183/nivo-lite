import { Command } from "@nestjs/cqrs"
import type { InstallationView } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveAgentRequest } from "./remove-agent.contracts"

/** Asks to remove an installed agent. */
export class RemoveAgentCommand extends Command<InstallationView> {
    constructor(readonly params: ExecuteParams<RemoveAgentRequest>) {
        super()
    }
}
