import { Query } from "@nestjs/cqrs"
import type { AgentSummary } from "@modules/domain/agents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListAgentsRequest } from "./list-agents.contracts"

/** Asks for the agents of the caller's workspace. */
export class ListAgentsQuery extends Query<ReadonlyArray<AgentSummary>> {
    constructor(readonly params: ExecuteParams<ListAgentsRequest>) {
        super()
    }
}
