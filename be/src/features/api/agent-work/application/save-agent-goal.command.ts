import { Command } from "@nestjs/cqrs"
import type { AgentGoalRecord } from "@modules/domain/agent-work"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveAgentGoalRequest } from "./save-agent-goal.contracts"

/** Asks to add or change a goal of an agent. */
export class SaveAgentGoalCommand extends Command<AgentGoalRecord> {
    constructor(readonly params: ExecuteParams<SaveAgentGoalRequest>) {
        super()
    }
}
