import { Query } from "@nestjs/cqrs"
import type { AgentGraphWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAgentGraphRequest } from "./get-agent-graph.contracts"

/** Opens the graph of one agent for the editor, seeding it on the first open. */
export class GetAgentGraphQuery extends Query<AgentGraphWire> {
    constructor(readonly params: ExecuteParams<GetAgentGraphRequest>) {
        super()
    }
}
