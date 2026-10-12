import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RenameAgentRequest } from "./rename-agent.contracts"

/** Asks to rename an agent. */
export class RenameAgentCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RenameAgentRequest>) {
        super()
    }
}
