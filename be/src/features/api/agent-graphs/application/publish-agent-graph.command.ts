import { Command } from "@nestjs/cqrs"
import type { GraphVersionView } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PublishAgentGraphRequest } from "./publish-agent-graph.contracts"

/** Publishes the draft of the graph of one agent as the next version. */
export class PublishAgentGraphCommand extends Command<GraphVersionView> {
    constructor(readonly params: ExecuteParams<PublishAgentGraphRequest>) {
        super()
    }
}
