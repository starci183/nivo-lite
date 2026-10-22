import { Query } from "@nestjs/cqrs"
import type { AgentPage } from "@modules/domain/agent-profile"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAgentPageRequest } from "./get-agent-page.contracts"

/** Asks for the profile page of one agent. */
export class GetAgentPageQuery extends Query<AgentPage> {
    constructor(readonly params: ExecuteParams<GetAgentPageRequest>) {
        super()
    }
}
