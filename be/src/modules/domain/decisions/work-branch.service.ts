import { Injectable, Optional } from "@nestjs/common"
import {
    InjectWorkBranchDecider,
    type GraphAnswer,
    type GraphCheck,
    type WorkBranchDecider,
} from "@modules/domain/authority-rules"
import type { BranchConsult, BranchOutcome } from "./work-branch.contracts"

/** The answer with no graph bound: nothing narrows what leaves. */
const NO_GRAPH: GraphAnswer = { outcome: "run", unread: [], unjudged: null, divert: null }

@Injectable()
/**
 * The one place the work engine asks the action graph. With no graph bound, or a graph with no say, the gate judges the proposal as
 * the owner rule reads it; an enforced graph answers with its own verdict and the proposal whose amount the records hold.
 */
export class WorkBranchService {
    constructor(@Optional() @InjectWorkBranchDecider() private readonly branches: WorkBranchDecider | null = null) {}

    /** What the graph says about something that leaves with no work item. */
    check(request: GraphCheck): Promise<GraphAnswer> {
        return this.branches?.check(request) ?? Promise.resolve(NO_GRAPH)
    }

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
            carried: {
                proposal: branch.proposal,
                ...(branch.decisionId === null ? {} : { branchDecisionId: branch.decisionId }),
                stopped: branch.stopped,
                divert: branch.divert,
            },
        }
    }
}
