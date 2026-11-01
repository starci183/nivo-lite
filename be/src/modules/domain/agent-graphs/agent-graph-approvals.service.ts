import { Injectable } from "@nestjs/common"
import type { BranchAnswerer, BranchRoute } from "@modules/domain/authority-rules"
import { ApprovalRequestsReadService, ApprovalRequestsService } from "@modules/domain/approval-requests"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { branchApprovalOf } from "./policies/branch-approver.policy"

@Injectable()
/**
 * The approval road of a branch ask: the request goes to the group, policy and wait the branch named, and while it is open only the
 * people it asked and the owner of the workspace may answer the item. It never resumes work, so the engine may inject it through the
 * branch decider; the end of the ask is AgentGraphAsksService.
 */
export class AgentGraphApprovalsService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly graphs: AgentGraphsService,
        private readonly decisions: AgentGraphDecisionsService,
        private readonly requests: ApprovalRequestsService,
        private readonly asked: ApprovalRequestsReadService,
    ) {}

    /** Opens the request of the branch that asked; a branch that named nobody, or a request that cannot open, leaves the item with the people who govern. */
    async route(route: BranchRoute): Promise<void> {
        const decision = await this.decisions.byId(route.decisionId)
        const approver = decision === null ? null : await this.graphs.approverOf(decision)
        if (decision === null || approver === null) return
        try {
            const opened = await this.requests.open({
                workspaceId: decision.workspaceId,
                chainStepId: decision.id,
                action: decision.action,
                amount: decision.amount,
                unit: "vnd",
                requestedByAgentId: decision.agentId,
                branch: branchApprovalOf(approver),
            })
            await this.decisions.attachRequest(decision.id, opened.requestId)
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.AskNotRouted, cause, { decisionId: decision.id })
        }
    }

    /** False when a request the branch opened is open and the answerer is not among the people it asked and not the owner. */
    async mayDecide(answerer: BranchAnswerer): Promise<boolean> {
        const decision = await this.decisions.byItem(answerer.workItemId)
        if (answerer.isOwner || decision === null || decision.closed || decision.approvalRequestId === null) return true
        const asked = await this.asked.askedOf(answerer.workspaceId, decision.approvalRequestId)
        return asked.length === 0 || asked.includes(answerer.memberId)
    }
}
