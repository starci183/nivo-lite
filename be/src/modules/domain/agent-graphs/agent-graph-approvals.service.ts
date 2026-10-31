import { Injectable } from "@nestjs/common"
import type { BranchAnswerer, BranchRoute } from "@modules/domain/authority-rules"
import { ApprovalRequestsReadService, ApprovalRequestsService } from "@modules/domain/approval-requests"
import type { BranchApproval } from "@modules/domain/approval-requests"
import { DecisionsError, DecisionsErrorCode, WorkEngineService } from "@modules/domain/decisions"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import type { DecisionView } from "./agent-graph-decisions.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import type { BranchApprover } from "./agent-graphs.contracts"

/** The language the lines of a settled ask are written in when no person's screen asked for one. */
const LOCALE = "vi"

/** Who the log names when a seat answered through the approval road: the decision log names the seat beside it. */
const ACTOR = "NIVO"

/** What the approval road of a graph hears of a request that ended. */
export interface AskEnded {
    /** The request. */
    readonly requestId: string
    /** Approved, rejected or expired; anything else is not an end this road knows. */
    readonly outcome: string
    /** The seat whose verdict settled it, when a verdict did. */
    readonly decidedBy?: string | undefined
}

const branchApproval = (approver: BranchApprover): BranchApproval => ({
    group: approver.group,
    policy: approver.policy,
    timeoutMinutes: approver.timeoutMinutes,
})

@Injectable()
/**
 * The approval road of a branch ask: the request goes to the group, policy and wait the branch named, a verdict of that group settles
 * the waiting item, an expired request takes the branch's answer to silence (a backup group, a stop, or the owner of the agent), and
 * while a request is open only the people it asked and the owner of the workspace may answer the item.
 */
export class AgentGraphApprovalsService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectIds() private readonly ids: Ids,
        private readonly graphs: AgentGraphsService,
        private readonly decisions: AgentGraphDecisionsService,
        private readonly requests: ApprovalRequestsService,
        private readonly asked: ApprovalRequestsReadService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Opens the request of the branch that asked; a branch that named nobody, or a request that cannot open, leaves the item with the people who govern. */
    async route(route: BranchRoute): Promise<void> {
        const decision = await this.decisions.byId(route.decisionId)
        const approver = decision === null ? null : await this.approverOf(decision)
        if (decision === null || approver === null) return
        try {
            const opened = await this.requests.open({
                workspaceId: decision.workspaceId,
                chainStepId: decision.id,
                action: decision.action,
                amount: decision.amount,
                unit: "vnd",
                requestedByAgentId: decision.agentId,
                branch: branchApproval(approver),
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

    /** A request ended: an approval or a refusal settles the item, a deadline takes the branch's answer to silence. Safe to run twice. */
    async ended(event: AskEnded): Promise<void> {
        const decision = await this.decisions.byRequest(event.requestId)
        if (decision === null || decision.closed) return
        if (event.outcome === "approved" || event.outcome === "rejected") {
            await this.settle(decision, event.outcome, event.decidedBy ?? null)
            return
        }
        if (event.outcome !== "expired") return
        const approver = await this.approverOf(decision)
        const onTimeout = approver?.onTimeout
        if (approver !== null && onTimeout?.kind === "backup") {
            await this.askBackup(decision, approver, onTimeout.group)
            return
        }
        if (onTimeout?.kind === "stop") await this.settle(decision, "rejected", null)
        await this.decisions.close(decision.workItemId, "expired")
    }

    private async askBackup(
        decision: DecisionView,
        approver: BranchApprover,
        group: BranchApproval["group"],
    ): Promise<void> {
        const opened = await this.requests.open({
            workspaceId: decision.workspaceId,
            chainStepId: this.ids.next(),
            action: decision.action,
            amount: decision.amount,
            unit: "vnd",
            requestedByAgentId: decision.agentId,
            branch: { ...branchApproval(approver), group },
        })
        await this.decisions.attachRequest(decision.id, opened.requestId)
    }

    private async settle(
        decision: DecisionView,
        outcome: "approved" | "rejected",
        memberId: string | null,
    ): Promise<void> {
        const ctx = { workspaceId: decision.workspaceId, actor: ACTOR, locale: LOCALE } as const
        const by =
            memberId === null
                ? { name: ACTOR, kind: "staff" as const }
                : { name: ACTOR, kind: "staff" as const, memberId }
        try {
            await this.engine.resumeWork(ctx, decision.workItemId, outcome, {}, by)
        } catch (cause) {
            if (!(cause instanceof DecisionsError) || cause.code !== DecisionsErrorCode.NotWaiting) throw cause
        }
        await this.decisions.close(decision.workItemId, outcome)
    }

    private async approverOf(decision: DecisionView): Promise<BranchApprover | null> {
        const document = await this.graphs.documentOf(decision.workspaceId, decision.agentId, decision.versionId)
        const node = document.nodes.find((entry) => entry.decide?.intent === decision.action)
        return node?.decide?.branches.find((branch) => branch.key === decision.branchKey)?.approver ?? null
    }
}
