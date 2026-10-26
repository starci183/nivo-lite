import { Query } from "@nestjs/cqrs"
import type { AgentKnowledgeLens } from "@modules/domain/agents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentKnowledgeLensesRequest } from "./agent-knowledge-lenses.contracts"

/** Reads what the customer and every active agent may read of the shared knowledge. */
export class AgentKnowledgeLensesQuery extends Query<ReadonlyArray<AgentKnowledgeLens>> {
    constructor(readonly params: ExecuteParams<AgentKnowledgeLensesRequest>) {
        super()
    }
}
