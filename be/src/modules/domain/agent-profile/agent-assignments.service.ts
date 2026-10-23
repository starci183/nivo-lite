import { Injectable } from "@nestjs/common"
import { AgentOwnershipService } from "@modules/domain/agents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { AssignRequest, AssignmentThread } from "./agent-profile.contracts"
import { ASSIGNMENT_TEXT_MAX } from "./agent-profile.contracts"
import { InjectAssignmentThreads, InjectAssignmentWork } from "./agent-profile.decorators"
import { isAssignableText, requestTextOf, taskOf, threadTitleOf } from "./agent-profile.policy"
import type { AssignmentThreads, AssignmentWork } from "./agent-profile.port"
import { AgentProfileError, AgentProfileErrorCode } from "./errors/agent-profile.error"

@Injectable()
/**
 * A person hands an agent work ("@AI Sales chot giup doan 12 khach"). The server decides who may: the member must be allowed by
 * the agent's `assignable_by` (a role or a room seat) and the agent must be active. The request opens a work thread whose first
 * message mentions the agent; the mention is built here from the agent id, never parsed out of the text, so what a person types
 * can never tag anybody else. When the member names the work (an action of the agent's department, its amount and the
 * customer), the agent starts it in that thread through the agents' runtime.
 */
export class AgentAssignmentsService {
    constructor(
        private readonly agents: AgentOwnershipService,
        private readonly members: WorkspaceMembersService,
        @InjectAssignmentThreads() private readonly threads: AssignmentThreads,
        @InjectAssignmentWork() private readonly work: AssignmentWork,
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
        const task = taskOf(request)
        const opened = await this.threads.open({
            workspaceId,
            authorMemberId: memberId,
            title: threadTitleOf(text),
            text,
            mentions: [{ kind: "agent", id: request.agentId }],
            leadId: task?.leadId ?? null,
        })
        if (task !== null) {
            const member = await this.members.require(userId, workspaceId)
            await this.work.start({
                workspaceId,
                threadId: opened.threadId,
                agentId: request.agentId,
                actorName: member.displayName,
                summary: text,
                task,
            })
        }
        return opened
    }
}
