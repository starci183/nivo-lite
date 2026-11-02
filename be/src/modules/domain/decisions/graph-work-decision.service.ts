import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type {
    GraphWorkClaim,
    GraphWorkDecisions,
    GraphWorkResume,
    GraphWorkOutcome,
} from "@modules/domain/agent-graphs"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { WorkDecisionTimeoutService } from "./work-decision-timeout.service"
import { WorkEngineService } from "./work-engine.service"

/** The graph's actor label when a background approval settles; the authenticated member remains separate. */
const ACTOR = "NIVO"

@Injectable()
/** Translates graph approvals into the work owner's guarded resume and row-locked timeout decisions. */
export class GraphWorkDecisionService implements GraphWorkDecisions {
    constructor(
        private readonly engine: WorkEngineService,
        private readonly timeouts: WorkDecisionTimeoutService,
    ) {}

    /** A competing resume is explicit; all other engine failures retain their original domain error. */
    async resume(request: GraphWorkResume): Promise<boolean> {
        const by =
            request.memberId === null
                ? { name: ACTOR, kind: "staff" as const }
                : {
                      name: ACTOR,
                      kind: "staff" as const,
                      memberId: request.memberId,
                  }
        try {
            await this.engine.resumeWork(
                { workspaceId: request.workspaceId, actor: ACTOR, locale: "vi" },
                request.workItemId,
                request.outcome,
                {},
                by,
            )
            return true
        } catch (cause) {
            if (cause instanceof DecisionsError && cause.code === DecisionsErrorCode.NotWaiting) return false
            throw cause
        }
    }

    /** The work row lock decides whether the graph may apply its deadline policy. */
    async claim(manager: EntityManager, workspaceId: string, workItemId: string): Promise<GraphWorkClaim> {
        const claim = await this.timeouts.claim(manager, workspaceId, workItemId)
        if (claim.kind === "busy") throw new DecisionsError({ code: DecisionsErrorCode.WorkBusy })
        return claim.kind === "open"
            ? claim
            : {
                  kind: "closed",
                  outcome: claim.item.status === "done" ? "approved" : "rejected",
              }
    }

    /** A competing human decision is replayed only after its authoritative outcome committed. */
    async closedOutcome(manager: EntityManager, workspaceId: string, workItemId: string): Promise<GraphWorkOutcome> {
        const claim = await this.claim(manager, workspaceId, workItemId)
        if (claim.kind !== "closed") throw new DecisionsError({ code: DecisionsErrorCode.WorkBusy })
        return claim.outcome
    }

    /** A lost timeout rejection remains retryable instead of closing an unrelated graph verdict. */
    async reject(manager: EntityManager, workspaceId: string, workItemId: string): Promise<void> {
        if (!(await this.timeouts.reject(manager, workspaceId, workItemId)))
            throw new DecisionsError({ code: DecisionsErrorCode.WorkBusy })
    }
}
