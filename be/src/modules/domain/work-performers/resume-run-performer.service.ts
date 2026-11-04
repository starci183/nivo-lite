import { Injectable } from "@nestjs/common"
import { AgentRunResumeService } from "@modules/domain/agent-runs"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "@modules/domain/decisions"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { textOf } from "./performer.policy"

@Injectable()
/**
 * `review_agent_run`: a run stopped for a fix and the owner reviewed it. Approving runs the run again from the step it stopped on; the done
 * steps keep their results and a message already sent is not sent again. A run that cannot be resumed (it was undone, or its step may have
 * acted) refuses, and the item stays with the owner.
 */
export class ResumeRunPerformerService implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly resumes: AgentRunResumeService,
    ) {}

    /** The proposal is preset by the road that raised the item. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Puts the run the item names back on its failed step. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const runId = textOf(proposal.fields.runId)
        if (runId === "")
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: item.id } })
        const actor = ("memberId" in by ? by.memberId : undefined) ?? by.name
        const answer = await this.resumes.resume({ runId, actor, reason: `item ${item.id}` })
        if (answer.kind !== "resumed")
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: item.id } })
        return { summary: this.kit.text(ctx, "runResumed"), evidence: "captured", lead_id: item.lead_id }
    }
}
