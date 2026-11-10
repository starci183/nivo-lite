import { Query } from "@nestjs/cqrs"
import type { AgentKnowledgeOverview } from "@modules/domain/agents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAgentKnowledgeRequest } from "./get-agent-knowledge.contracts"

/** Asks what one agent reads of the shared knowledge, layer by layer and document by document. */
export class GetAgentKnowledgeQuery extends Query<AgentKnowledgeOverview> {
    constructor(readonly params: ExecuteParams<GetAgentKnowledgeRequest>) {
        super()
    }
}
