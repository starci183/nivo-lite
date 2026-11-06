import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import type { BranchApproval, OpenApprovalParams } from "@modules/domain/approval-requests"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import type { DecisionView } from "./agent-graph-decisions.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { BranchApprover } from "./agent-graphs.contracts"
import { branchApprovalOf } from "./policies/branch-approver.policy"
import { InjectGraphWorkDecisions } from "./agent-graphs.decorators"
import type { GraphWorkDecisions } from "./graph-work-decisions.port"

/** What the end of an ask hears of a request that ended. */
export interface AskEnded {
    /** The workspace of the request. */
    readonly workspaceId: string
    /** The request. */
    readonly requestId: string
    /** Approved, rejected or expired; anything else is not an end this road knows. */
    readonly outcome: string
    /** The seat whose verdict settled it, when a verdict did. */
    readonly decidedBy?: string | undefined
}

@Injectable()
/**
 * The end of a branch ask: a verdict of the group it asked settles the waiting item, and an expired request takes the branch's answer to
 * silence (a backup group, a stop, or the owner of the agent). It resumes work, so the engine that routes asks never injects it.
 */
export class AgentGraphAsksService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectIds() private readonly ids: Ids,
        private readonly graphs: AgentGraphsService,
        private readonly decisions: AgentGraphDecisionsService,
        private readonly requests: ApprovalRequestsService,
        @InjectGraphWorkDecisions() private readonly work: GraphWorkDecisions,
    ) {}

    /** A request ended: an approval or a refusal settles the item, a deadline takes the branch's answer to silence. Safe to run twice. */
    async ended(event: AskEnded, manager?: EntityManager): Promise<void> {
        const decision =
            manager === undefined
                ? await this.decisions.byRequest(event.workspaceId, event.requestId)
                : await this.decisions.byRequest(event.workspaceId, event.requestId, manager)
        if (decision === null || decision.closed) return
        if (event.outcome === "approved" || event.outcome === "rejected") {
            await this.settle(decision, event.outcome, event.decidedBy ?? null)
            return
        }
        if (event.outcome !== "expired") return
        if (manager === undefined) {
            await this.entityManager.transaction(async (tx) => {
                if (await this.closeClaimed(decision, tx)) return
                await this.ended(event, tx)
            })
            return
        }
        if (await this.closeClaimed(decision, manager)) return
        const approver = await this.graphs.approverOf(decision)
        const onTimeout = approver?.onTimeout
        if (approver !== null && onTimeout?.kind === "backup") {
            await this.askBackup(decision, approver, onTimeout.group, manager)
            return
        }
        if (onTimeout?.kind === "stop") {
            await this.work.reject(manager, decision.workspaceId, decision.workItemId)
            await this.decisions.close(decision.workspaceId, decision.workItemId, "rejected", manager)
        }
        await this.decisions.close(decision.workspaceId, decision.workItemId, "expired", manager)
    }

    private async closeClaimed(decision: DecisionView, manager: EntityManager): Promise<boolean> {
        const claim = await this.work.claim(manager, decision.workspaceId, decision.workItemId)
        if (claim.kind !== "closed") return false
        await this.decisions.close(decision.workspaceId, decision.workItemId, claim.outcome, manager)
        return true
    }

    private async askBackup(
        decision: DecisionView,
        approver: BranchApprover,
        group: BranchApproval["group"],
        manager: EntityManager,
    ): Promise<void> {
        const params: OpenApprovalParams = {
            workspaceId: decision.workspaceId,
            chainStepId: this.ids.next(),
            action: decision.action,
            amount: decision.amount,
            unit: "vnd",
            requestedByAgentId: decision.agentId,
            branch: { ...branchApprovalOf(approver), group },
        }
        const opened = await this.requests.open(params, manager)
        await this.decisions.attachRequest(decision.workspaceId, decision.id, opened.requestId, manager)
    }

    private async settle(
        decision: DecisionView,
        outcome: "approved" | "rejected",
        memberId: string | null,
    ): Promise<void> {
        const resumed = await this.work.resume({
            workspaceId: decision.workspaceId,
            workItemId: decision.workItemId,
            outcome,
            memberId,
        })
        if (!resumed) {
            await this.entityManager.transaction(async (manager) => {
                const closed = await this.work.closedOutcome(manager, decision.workspaceId, decision.workItemId)
                await this.decisions.close(decision.workspaceId, decision.workItemId, closed, manager)
            })
            return
        }
        await this.decisions.close(decision.workspaceId, decision.workItemId, outcome)
    }
}
