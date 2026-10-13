import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentStatusRequest } from "./set-agent-status.contracts"

/** Asks to pause or resume an agent. */
export class SetAgentStatusCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetAgentStatusRequest>) {
        super()
    }
}
