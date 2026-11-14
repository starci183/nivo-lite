import { Query } from "@nestjs/cqrs"
import type { AgentNodeRights } from "@modules/domain/node-right-rollups"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAgentNodeRightsRequest } from "./get-agent-node-rights.contracts"

/** The rights page of one agent: its attached accounts and what its running workflow nodes call on them. */
export class GetAgentNodeRightsQuery extends Query<AgentNodeRights> {
    constructor(readonly params: ExecuteParams<GetAgentNodeRightsRequest>) {
        super()
    }
}
