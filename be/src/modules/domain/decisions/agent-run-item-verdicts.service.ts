import { Injectable } from "@nestjs/common"
import { WorkItemsDecisionsReadService, WorkItemsService } from "@modules/domain/work-items"
import type { EntityManager } from "typeorm"
import type { AgentRunItemVerdicts, RunTimeoutClaim, StepDecision } from "@modules/domain/agent-runs"
import { DecisionLogReadService } from "./decision-log-read.service"

@Injectable()
/** Reads closed work items as durable decisions, including the data approved after any human edit. */
export class AgentRunItemVerdictsService implements AgentRunItemVerdicts {
    constructor(
        private readonly items: WorkItemsService,
        private readonly decisions: DecisionLogReadService,
        private readonly reads: WorkItemsDecisionsReadService,
    ) {}

    /** Shares the decision owner's row lock with the transaction that will persist the wait outcome. */
    async claimTimeout(manager: EntityManager, workspaceId: string, itemId: string): Promise<RunTimeoutClaim> {
        const claim = await this.reads.claimDecision(manager, workspaceId, itemId)
        if (claim.kind !== "closed") return claim
        const actors = await this.decisions.decidersOf([claim.item.id], manager)
        return {
            kind: "closed",
            decision: {
                approved: claim.item.status === "done",
                by: actors.get(claim.item.id) ?? null,
                data: { fields: { ...claim.item.proposal.fields }, draft: claim.item.proposal.draft ?? null },
            },
        }
    }

    /** The verdict of each item that closed by a decision. */
    async verdictsOf(ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, StepDecision>> {
        if (ids.length === 0) return new Map()
        const items = await this.items.findMany(ids, ids.length)
        const actors = await this.decisions.decidersOf(
            items.filter((item) => item.status === "done" || item.status === "rejected").map((item) => item.id),
        )
        const verdicts = new Map<string, StepDecision>()
        for (const item of items) {
            if (item.status !== "done" && item.status !== "rejected") continue
            verdicts.set(item.id, {
                approved: item.status === "done",
                by: actors.get(item.id) ?? null,
                data: { fields: { ...item.proposal.fields }, draft: item.proposal.draft ?? null },
            })
        }
        return verdicts
    }
}
