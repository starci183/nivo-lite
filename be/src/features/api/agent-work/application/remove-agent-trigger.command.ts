import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveAgentTriggerRequest } from "./remove-agent-trigger.contracts"

/** Asks to remove a trigger of an agent. */
export class RemoveAgentTriggerCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RemoveAgentTriggerRequest>) {
        super()
    }
}
