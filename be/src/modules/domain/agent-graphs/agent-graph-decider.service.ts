import { Injectable, Optional } from "@nestjs/common"
import type {
    BranchAnswerer,
    BranchRequest,
    BranchRoute,
    OptionalBranchJudgement,
    WorkBranchDecider,
} from "@modules/domain/authority-rules"
import type { Proposal } from "@modules/domain/work-items"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AgentGraphApprovalsService } from "./agent-graph-approvals.service"
import { InjectAgentGraphApprovals } from "./agent-graphs.decorators"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { MODEL_AMOUNT_FACT } from "./agent-graphs.contracts"
import type { FactRegistry, FactValue, FactValues } from "./agent-graphs.contracts"
import { GraphFactsService } from "./graph-facts.service"
import { pickBranch, strictest } from "./policies/strictest.policy"

/** The amount in dong the records hold: the first numeric fact counted in dong, or null when none was read. */
const recordAmountOf = (facts: FactValues, registry: FactRegistry): number | null => {
    const key = Object.keys(facts).find((fact) => registry[fact]?.unit === "vnd")
    const value = key === undefined ? undefined : facts[key]
    return typeof value === "number" ? value : null
}

/** The proposal with the amount the records hold in place of the one the model wrote. */
const withAmount = (proposal: Proposal, amount: number): Proposal => ({
    ...proposal,
    amount_vnd: amount,
    fields: { ...proposal.fields, amount_vnd: amount },
})

/** The facts as stored: only the ones that were read, and the model amount beside the real one when they differ. */
const factsRecorded = (facts: FactValues, modelAmount: number | null | undefined): Readonly<Record<string, FactValue>> => ({
    ...Object.fromEntries(Object.entries(facts).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]]))),
    ...(typeof modelAmount === "number" ? { [MODEL_AMOUNT_FACT]: modelAmount } : {}),
})

@Injectable()
/**
 * The branch of the action graph, run in the one door every action passes. It reads the facts of the item from real records, picks the
 * first matching branch (a fact it could not read takes the `else`, and an `else` never runs alone), and records the decision once.
 * A graph in shadow records and leaves the verdict to the gate; an enforced graph replaces the amount the model wrote with the one
 * the records hold and answers the stricter of the gate and the branch. No graph, or no decide point for the action, or a failure
 * reading it, leaves the item to the gate alone.
 */
export class AgentGraphDeciderService implements WorkBranchDecider {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly graphs: AgentGraphsService,
        private readonly facts: GraphFactsService,
        private readonly decisions: AgentGraphDecisionsService,
        @Optional() @InjectAgentGraphApprovals() private readonly approvals: AgentGraphApprovalsService | null = null,
    ) {}

    /** Puts a waiting item in front of the approver its branch named. */
    route(route: BranchRoute): Promise<void> {
        return this.approvals === null ? Promise.resolve() : this.approvals.route(route)
    }

    /** Whether this seat may answer the waiting item while the request of its branch is open. */
    mayDecide(answerer: BranchAnswerer): Promise<boolean> {
        return this.approvals === null ? Promise.resolve(true) : this.approvals.mayDecide(answerer)
    }

    /** The judgement of the branch for one item, or null when the gate decides alone. */
    async decide(request: BranchRequest): Promise<OptionalBranchJudgement> {
        try {
            return await this.judge(request)
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.DecideFailed, cause, { workItemId: request.item.id })
            return null
        }
    }

    private async judge({ item, proposal, gate, turnId, wakeId }: BranchRequest): Promise<OptionalBranchJudgement> {
        if (item.installation_id === null) return null
        const state = await this.graphs.stateOfInstallation(item.installation_id)
        const node = state?.active?.nodes.find((entry) => entry.decide?.intent === item.action)
        const decide = node?.decide
        const versionId = state?.activeVersionId ?? null
        if (state === null || versionId === null || decide === undefined) return null
        const registry = this.facts.registry()
        const read = await this.facts.read(
            item.workspace_id,
            { type: item.subject_type, id: item.subject_id ?? "", workItemId: item.id },
            decide.facts,
        )
        const branch = pickBranch(decide, read, registry)
        if (branch === null) return null
        const amount = recordAmountOf(read, registry)
        const enforced = state.mode === "enforced"
        const judged = enforced && amount !== null ? withAmount(proposal, amount) : proposal
        const base = await gate(judged)
        const verdict = strictest(base, branch.then)
        const decisionId = await this.decisions.record({
            workspaceId: item.workspace_id,
            agentId: state.agentId,
            workItemId: item.id,
            versionId,
            turnId,
            wakeId,
            action: item.action,
            path: [node?.key ?? "", branch.next],
            facts: factsRecorded(read, amount !== null && amount !== proposal.amount_vnd ? proposal.amount_vnd : undefined),
            branchKey: branch.key,
            outcome: branch.then,
            shadowDiff: verdict.verdict !== base.verdict || verdict.reason !== base.reason,
        })
        return enforced ? { proposal: judged, verdict, decisionId } : null
    }
}
