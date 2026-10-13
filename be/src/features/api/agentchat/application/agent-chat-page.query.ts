import { Query } from "@nestjs/cqrs"
import type { AgentChatPageRequest, AgentChatPageData } from "@modules/domain/agent-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Requests agentChatPage in the caller's selected workspace. */
export class GetAgentChatPageQuery extends Query<AgentChatPageData> {
    constructor(readonly params: ExecuteParams<AgentChatPageRequest>) {
        super()
    }
}
