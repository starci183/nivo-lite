import { Query } from "@nestjs/cqrs"
import type { AgentChatTurnStatusRequest, AgentChatTurnStatus } from "@modules/domain/agent-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Requests agentChatTurnStatus in the caller's selected workspace. */
export class GetAgentChatTurnStatusQuery extends Query<AgentChatTurnStatus> {
    constructor(readonly params: ExecuteParams<AgentChatTurnStatusRequest>) {
        super()
    }
}
