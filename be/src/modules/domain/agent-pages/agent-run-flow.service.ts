import { Injectable, Optional } from "@nestjs/common"
import { ThreadApprovalsService, ThreadResumeRequestsService } from "@modules/domain/agent-threads"
import { AgentWorkError, AgentWorkErrorCode } from "@modules/domain/agent-work"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { approvesOf, localeOf, mayDecide, payloadOf, refusalOf, workItemIdOf } from "./agent-run-flow.policy"
import type { RunFlowResult } from "./agent-run-flow.contracts"

@Injectable()
/**
 * `runFlow` kind `decide`: the verdict on a work item a thread approval wrote (`approve_tool_call`), by the item's id, handed to the
 * thread approvals' one door, the same door `decideAgentRunStep` and the chat stop card use. A member must sit in the workspace; only an
 * owner or manager decides, and the door lets only the owner approve. It is no engine of its own: the old flow engine is deleted.
 */
export class AgentRunFlowService {
    constructor(
        private readonly members: WorkspaceMembersService,
        @Optional() private readonly approvals?: ThreadApprovalsService,
        @Optional() private readonly threads?: ThreadResumeRequestsService,
    ) {}

    /** Decides the work item the payload names as the member; a refusal of the door is a typed error. */
    async decide(userId: string, workspaceId: string, request: object): Promise<RunFlowResult> {
        const member = await this.members.require(userId, workspaceId, [])
        const payload = payloadOf(request)
        const workItemId = workItemIdOf(payload)
        const approves = approvesOf(payload)
        if (!mayDecide(member.role)) throw new AgentWorkError({ code: AgentWorkErrorCode.ApprovalNotAllowed })
        if (this.approvals === undefined || this.threads === undefined)
            throw new AgentWorkError({ code: AgentWorkErrorCode.ApprovalNotFound })
        const outcome = await this.approvals.verdict(
            {
                workspaceId,
                workItemId,
                verdict: approves ? "approved" : "refused",
                by: await this.members.idOf(userId, workspaceId),
                owner: member.role === "owner",
                locale: localeOf(payload),
            },
            this.threads,
        )
        if (outcome.kind === "refused") throw refusalOf(outcome)
        return { data: { id: outcome.workItemId, status: outcome.status } }
    }
}
