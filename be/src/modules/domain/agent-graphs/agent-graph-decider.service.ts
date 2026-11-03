import { Injectable, Optional } from "@nestjs/common"
import { HANDOVER_TO_FACT, TOOL_CONNECTOR_FACT, TOOL_NAME_FACT } from "@modules/domain/authority-rules"
import type {
    BranchAnswerer,
    BranchRequest,
    BranchRoute,
    GateVerdict,
    GraphAnswer,
    GraphCheck,
    OptionalBranchJudgement,
    WorkBranchDecider,
} from "@modules/domain/authority-rules"
import type { Proposal, WorkItem } from "@modules/domain/work-items"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AgentGraphApprovalsService } from "./agent-graph-approvals.service"
import { AgentGraphChecksService, closedAsOf, factsRead, outcomeOf } from "./agent-graph-checks.service"
import { InjectAgentGraphApprovals } from "./agent-graphs.decorators"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { MODEL_AMOUNT_FACT } from "./agent-graphs.contracts"
import type { FactRegistry, FactValue, FactValues } from "./agent-graphs.contracts"
import type { GraphWalk } from "./agent-graphs-walk.contracts"
import type { FactSubject } from "./agent-graphs.port"
import { isFlowOnly } from "./policies/flow.policy"
import { strictest } from "./policies/strictest.policy"

/** The amount in dong the records hold: the first numeric fact of the work counted in dong, or null when none was read. */
const recordAmountOf = (facts: FactValues, registry: FactRegistry): number | null => {
    const key = Object.keys(facts).find(
        (fact) => registry[fact]?.unit === "vnd" && registry[fact].notWorkAmount !== true,
    )
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
const factsRecorded = (
    facts: FactValues,
    modelAmount: number | null | undefined,
): Readonly<Record<string, FactValue>> => ({
    ...factsRead(facts),
    ...(typeof modelAmount === "number" ? { [MODEL_AMOUNT_FACT]: modelAmount } : {}),
})

/** What the road knows about a held call or a hand-over, from what the backend itself will run. */
const attributesOf = (fields: Proposal["fields"]): Readonly<Record<string, string>> => {
    const { tool, to } = fields
    return {
        ...(typeof tool === "string"
            ? { [TOOL_NAME_FACT]: tool, [TOOL_CONNECTOR_FACT]: tool.split(".", 1).join("") }
            : {}),
        ...(typeof to === "string" ? { [HANDOVER_TO_FACT]: to } : {}),
    }
}

const subjectOf = (item: WorkItem, proposal: Proposal): FactSubject => ({
    type: item.subject_type,
    id: item.subject_id ?? "",
    workItemId: item.id,
    amountVnd: proposal.amount_vnd,
    text: proposal.draft,
    leadId: item.lead_id,
    attributes: attributesOf(proposal.fields),
    evidence: proposal.evidence ?? [],
})

/** The verdict of a walk over the gate's: the graph narrows and never loosens. */
const verdictOf = (gate: GateVerdict, walk: GraphWalk): GateVerdict => {
    if (walk.outcome === "ask") return strictest(gate, "ask")
    return walk.outcome === "stop" ? strictest(gate, "stop") : gate
}

@Injectable()
/**
 * The action graph, in the one door every work item passes and for what leaves with no work item. It walks the published graph on what
 * the agent proposes, with the facts read by the backend, and records one run. An enforced graph replaces the amount the model wrote
 * with the one the records hold and answers the stricter of the gate and the walk; a stop ends the work and a branch that leads to
 * another action runs that action. A graph the owner set to shadow records and leaves the verdict to the gate, and so does an action
 * no node holds. A graph that holds the action and cannot be read or walked asks a person: it never falls through to run alone.
 */
export class AgentGraphDeciderService implements WorkBranchDecider {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly graphs: AgentGraphsService,
        private readonly checks: AgentGraphChecksService,
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

    /** What the graph says about something that leaves with no work item. */
    check(request: GraphCheck): Promise<GraphAnswer> {
        return this.checks.check(request)
    }

    /** The judgement of the graph for one item, or null when the gate decides alone. */
    async decide(request: BranchRequest): Promise<OptionalBranchJudgement> {
        try {
            return await this.judge(request)
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.DecideFailed, cause, { workItemId: request.item.id })
            return this.safely(request)
        }
    }

    /** The answer when the graph could not judge: the item asks, on the people who govern, because no decision names an approver. */
    private async safely({ proposal, gate }: BranchRequest): Promise<OptionalBranchJudgement> {
        return {
            proposal,
            verdict: strictest(await gate(proposal), "ask"),
            decisionId: null,
            stopped: false,
            divert: null,
        }
    }

    private async judge(request: BranchRequest): Promise<OptionalBranchJudgement> {
        const { item, proposal, gate, turnId, wakeId } = request
        if (item.installation_id === null) return null
        const state = await this.graphs.stateOfInstallation(item.installation_id)
        const versionId = state?.activeVersionId ?? null
        if (state === null || versionId === null) return null
        const enforced = state.mode === "enforced"
        if (state.active === null) return enforced ? this.safely(request) : null
        if (isFlowOnly(state.active)) return null
        const { walk, read, registry } = await this.checks.walk(
            item.workspace_id,
            state.active,
            item.action,
            subjectOf(item, proposal),
        )
        const amount = walk.outcome === "unheld" ? null : recordAmountOf(read, registry)
        const judged = enforced && amount !== null ? withAmount(proposal, amount) : proposal
        const base = await gate(judged)
        const verdict = verdictOf(base, walk)
        const decisionId = await this.decisions.record({
            workspaceId: item.workspace_id,
            agentId: state.agentId,
            workItemId: item.id,
            dedupeKey: null,
            road: "work",
            mode: state.mode,
            gateVerdict: base.verdict,
            versionId,
            turnId,
            wakeId,
            action: item.action,
            path: walk.path,
            facts: factsRecorded(
                read,
                amount !== null && amount !== proposal.amount_vnd ? proposal.amount_vnd : undefined,
            ),
            branchKey: walk.branchKey,
            outcome: outcomeOf(walk),
            shadowDiff: verdict.verdict !== base.verdict || verdict.reason !== base.reason || walk.outcome === "divert",
            unread: walk.unread,
            unjudged: walk.unjudged,
            subjectType: item.subject_type,
            subjectId: item.subject_id,
            closedAs: enforced ? closedAsOf(walk) : null,
        })
        if (!enforced || walk.outcome === "unheld") return null
        return { proposal: judged, verdict, decisionId, stopped: walk.outcome === "stop", divert: walk.divert }
    }
}
