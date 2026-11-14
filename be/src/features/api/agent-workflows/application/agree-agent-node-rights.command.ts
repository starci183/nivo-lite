import { Command } from "@nestjs/cqrs"
import type { AgentRightsAgreed } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgreeAgentNodeRightsRequest } from "./agree-agent-node-rights.contracts"

/** One consent of the owner over what the running workflows of an agent ask for on connected accounts. */
export class AgreeAgentNodeRightsCommand extends Command<AgentRightsAgreed> {
    constructor(readonly params: ExecuteParams<AgreeAgentNodeRightsRequest>) {
        super()
    }
}
