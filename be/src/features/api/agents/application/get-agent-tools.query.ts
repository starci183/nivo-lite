import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentToolLine } from "@modules/domain/agent-pages"
import type { GetAgentToolsRequest } from "./get-agent-tools.contracts"

/** Asks for the tools one agent can call, in the shop's words, with the accounts and grant rows that bound them. */
export class GetAgentToolsQuery extends Query<ReadonlyArray<AgentToolLine>> {
    constructor(readonly params: ExecuteParams<GetAgentToolsRequest>) {
        super()
    }
}
