import { Query } from "@nestjs/cqrs"
import type { AgentSummary } from "@modules/domain/agents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListConnectionAgentsRequest } from "./list-connection-agents.contracts"

/** Asks for the agents a connection can be attached to. */
export class ListConnectionAgentsQuery extends Query<ReadonlyArray<AgentSummary>> {
    constructor(readonly params: ExecuteParams<ListConnectionAgentsRequest>) {
        super()
    }
}
