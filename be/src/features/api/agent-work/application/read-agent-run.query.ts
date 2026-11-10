import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentRunDetail, ReadAgentRunRequest } from "./read-agent-runs.contracts"

/** Asks for one run of an agent with its steps and the work item it is about; null when the agent has no such run. */
export class ReadAgentRunQuery extends Query<AgentRunDetail | null> {
    constructor(readonly params: ExecuteParams<ReadAgentRunRequest>) {
        super()
    }
}
