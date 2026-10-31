import { Query } from "@nestjs/cqrs"
import type { AgentWorkView } from "@modules/domain/agent-work"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadAgentWorkRequest } from "./read-agent-work.contracts"

/** Asks for the work of one agent: its switch, goals, tasks, triggers and last turns. */
export class ReadAgentWorkQuery extends Query<AgentWorkView> {
    constructor(readonly params: ExecuteParams<ReadAgentWorkRequest>) {
        super()
    }
}
