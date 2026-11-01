import { Injectable } from "@nestjs/common"
import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import type { BranchApproval } from "@modules/domain/approval-requests"
import { DecisionsError, DecisionsErrorCode, WorkEngineService } from "@modules/domain/decisions"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import type { DecisionView } from "./agent-graph-decisions.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { BranchApprover } from "./agent-graphs.contracts"
import { branchApprovalOf } from "./policies/branch-approver.policy"

/** The language the lines of a settled ask are written in when no person's screen asked for one. */
const LOCALE = "vi"

/** Who the log names when a seat answered through the approval road: the decision log names the seat beside it. */
const ACTOR = "NIVO"

/** What the end of an ask hears of a request that ended. */
export interface AskEnded {
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
        @InjectIds() private readonly ids: Ids,
        private readonly graphs: AgentGraphsService,
        private readonly decisions: AgentGraphDecisionsService,
        private readonly requests: ApprovalRequestsService,
        private readonly engine: WorkEngineService,
    ) {}

    /** A request ended: an approval or a refusal settles the item, a deadline takes the branch's answer to silence. Safe to run twice. */
    async ended(event: AskEnded): Promise<void> {
        const decision = await this.decisions.byRequest(event.requestId)
        if (decision === null || decision.closed) return
        if (event.outcome === "approved" || event.outcome === "rejected") {
            await this.settle(decision, event.outcome, event.decidedBy ?? null)
            return
        }
        if (event.outcome !== "expired") return
        const approver = await this.graphs.approverOf(decision)
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
            branch: { ...branchApprovalOf(approver), group },
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
}
