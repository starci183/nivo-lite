import { Injectable, Optional } from "@nestjs/common"
import { InjectWorkBranchDecider } from "@modules/domain/authority-rules"
import type { WorkBranchDecider } from "@modules/domain/authority-rules"
import type { BranchConsult, BranchOutcome } from "./work-branch.contracts"

@Injectable()
/**
 * The one place the work engine asks the action graph. With no graph bound, or a graph with no say, the gate judges the proposal as
 * the owner rule reads it; an enforced graph answers with its own verdict and the proposal whose amount the records hold.
 */
export class WorkBranchService {
    constructor(@Optional() @InjectWorkBranchDecider() private readonly branches: WorkBranchDecider | null = null) {}

    /** The proposal to judge, its verdict, and the decision a waiting item keeps. */
    async consult({ workspaceId, item, proposal, origin, gate }: BranchConsult): Promise<BranchOutcome> {
        const branch = await this.branches?.decide({
            workspaceId,
            item,
            proposal,
            gate,
            turnId: origin?.turnId ?? null,
            wakeId: origin?.wakeId ?? null,
        })
        if (branch === null || branch === undefined) return { proposal, verdict: await gate(proposal), carried: {} }
        return {
            proposal: branch.proposal,
            verdict: branch.verdict,
            carried: { proposal: branch.proposal, branchDecisionId: branch.decisionId },
        }
    }
}
