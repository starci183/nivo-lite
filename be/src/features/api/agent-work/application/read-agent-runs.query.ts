import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentRunsBoard, ReadAgentRunsRequest } from "./read-agent-runs.contracts"

/** Asks for the runs of one agent: the list with its workflows and what is running and queued now. */
export class ReadAgentRunsQuery extends Query<AgentRunsBoard> {
    constructor(readonly params: ExecuteParams<ReadAgentRunsRequest>) {
        super()
    }
}
