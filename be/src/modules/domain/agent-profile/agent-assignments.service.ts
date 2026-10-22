import { Injectable } from "@nestjs/common"
import { AgentOwnershipService } from "@modules/domain/agents"
import type { AssignRequest, AssignmentThread } from "./agent-profile.contracts"
import { ASSIGNMENT_TEXT_MAX } from "./agent-profile.contracts"
import { InjectAssignmentThreads } from "./agent-profile.decorators"
import { isAssignableText, requestTextOf, threadTitleOf } from "./agent-profile.policy"
import type { AssignmentThreads } from "./agent-profile.port"
import { AgentProfileError, AgentProfileErrorCode } from "./errors/agent-profile.error"

@Injectable()
/**
 * A person hands an agent work ("@AI Sales chot giup doan 12 khach"). The server decides who may: the member must be allowed by
 * the agent's `assignable_by` (a role or a room seat) and the agent must be active. The request opens a work thread whose first
 * message mentions the agent; the mention is built here from the agent id, never parsed out of the text, so what a person types
 * can never tag anybody else.
 */
export class AgentAssignmentsService {
    constructor(
        private readonly agents: AgentOwnershipService,
        @InjectAssignmentThreads() private readonly threads: AssignmentThreads | null,
    ) {}

    /** Opens the thread that carries the assignment and answers it. */
    async assign(userId: string, workspaceId: string, request: AssignRequest): Promise<AssignmentThread> {
        const text = requestTextOf(request.text)
        if (!isAssignableText(text))
            throw new AgentProfileError({
                code: AgentProfileErrorCode.RequestInvalid,
                params: { max: ASSIGNMENT_TEXT_MAX },
            })
        const memberId = await this.agents.memberIdOf(userId, workspaceId)
        if (!(await this.agents.canAssign(memberId, request.agentId)))
            throw new AgentProfileError({ code: AgentProfileErrorCode.AssignForbidden })
        if (this.threads === null) throw new AgentProfileError({ code: AgentProfileErrorCode.ThreadsUnbound })
        return this.threads.open({
            workspaceId,
            authorMemberId: memberId,
            title: threadTitleOf(text),
            text,
            mentions: [{ kind: "agent", id: request.agentId }],
        })
    }
}
