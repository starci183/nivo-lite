import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentOwnershipRequest } from "./set-agent-ownership.contracts"

/** Asks to replace who is in charge of an agent and who may give it work or be tagged by it. */
export class SetAgentOwnershipCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetAgentOwnershipRequest>) {
        super()
    }
}
