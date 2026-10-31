import { Command } from "@nestjs/cqrs"
import type { AgentTriggerRecord } from "@modules/domain/agent-work"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveAgentTriggerRequest } from "./save-agent-trigger.contracts"

/** Asks to add or change a trigger of an agent. */
export class SaveAgentTriggerCommand extends Command<AgentTriggerRecord> {
    constructor(readonly params: ExecuteParams<SaveAgentTriggerRequest>) {
        super()
    }
}
