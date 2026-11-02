import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import type { IntentBusiness, IntentGap } from "@modules/domain/intent-contracts"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type { GraphDocument, GraphProposalView, LearnedProposal } from "./agent-graphs.contracts"
import { intentBusinessSchema } from "./agent-graphs.schema"
import { AgentGraphProposalEntity } from "./persistence/entities"
import { gapKeyOf } from "./policies/intent-gap.policy"
import { learnSignals } from "./policies/learn-signals.policy"
import type { ConflictPatch } from "./policies/conflict-patch.policy"
import { valueHashOf } from "./policies/conflict.policy"
import type { LearnedPatch } from "./policies/proposal-patch.policy"

/** The most proposals read to know which evidence is spent. */
const SPENT_LIMIT = 1000

/** A replaced Brain rule, as the proposal that says so. */
export interface ConflictRaised {
    /** The node that cites the rule. */
    readonly nodeKey: string
    /** The branch that cites it, or an empty text for the node itself. */
    readonly branchKey: string
    /** The rule that was replaced. */
    readonly oldFactId: string
    /** The rule in force now. */
    readonly newFactId: string
    /** The hash of its value. */
    readonly newValueHash: string
    /** What makes the proposal the same one however often the tick runs. */
    readonly dedupeKey: string
}

/** The most proposals one listing answers. */
const PROPOSAL_LIMIT = 100

/** A text member of the patch of a proposal, or null when it holds none. */
const patchTextOf = (row: AgentGraphProposalEntity, member: string): string | null => {
    const value = row.patch[member]
    return typeof value === "string" ? value : null
}

const viewOf = (row: AgentGraphProposalEntity): GraphProposalView => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    nodeKey: row.nodeKey,
    branchKey: row.branchKey,
    widens: row.widens,
    evidence: row.evidence,
    createdAt: row.createdAt.toISOString(),
    intent: patchTextOf(row, "intent"),
    text: patchTextOf(row, row.kind === "gap" ? "question" : "task"),
})

/** The node that holds a branch, or null when the graph no longer has it. */
const nodeOfBranch = (graph: GraphDocument, branchKey: string): string | null =>
    graph.nodes.find((node) => node.decide?.branches.some((branch) => branch.key === branchKey))?.key ?? null

@Injectable()
/**
 * What the graph proposes to its owner. Learning only proposes: it reads closed decisions in code, with no model, and raises a
 * proposal that lists the decisions as evidence; no version changes until a person confirms it. A proposal whose branch is gone
 * is superseded, and the same cause never raises two proposals (the dedupe key is unique for the agent).
 */
export class AgentGraphProposalsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly decisions: AgentGraphDecisionsService,
    ) {}

    /** Raises the proposals the closed decisions of the agent teach; answers how many new ones were written. */
    async learn(workspaceId: string, agentId: string, versionId: string | null, graph: GraphDocument): Promise<number> {
        const learned = learnSignals(await this.decisions.closedOf(workspaceId, agentId))
        const spent = await this.spentEvidence(workspaceId, agentId)
        const fresh = learned.filter(
            (proposal) => !proposal.evidence.some((id) => spent.has(`${proposal.branchKey}:${proposal.signal}:${id}`)),
        )
        const written = await Promise.all(
            fresh.map((proposal) => this.raise(workspaceId, agentId, versionId, graph, proposal)),
        )
        return written.filter(Boolean).length
    }

    /** Raises the proposal that a newer rule of the Brain replaced the one a node cites; the same replacement is raised once. */
    async raiseConflict(
        workspaceId: string,
        agentId: string,
        versionId: string,
        conflict: ConflictRaised,
    ): Promise<boolean> {
        const inserted = await this.entityManager
            .createQueryBuilder(AgentGraphProposalEntity, "proposal")
            .insert()
            .into(AgentGraphProposalEntity)
            .values({
                workspaceId,
                agentId,
                dedupeKey: conflict.dedupeKey,
                kind: "conflict",
                baseVersionId: versionId,
                nodeKey: conflict.nodeKey,
                branchKey: conflict.branchKey === "" ? null : conflict.branchKey,
                patch: {
                    oldFactId: conflict.oldFactId,
                    newFactId: conflict.newFactId,
                    newValueHash: conflict.newValueHash,
                },
                widens: false,
                evidence: [conflict.oldFactId, conflict.newFactId],
            })
            .orIgnore()
            .execute()
        return inserted.identifiers.length > 0
    }

    /**
     * Raises the gap a turn found: the work nothing in the published graph fits. It is informational, so it changes nothing; the owner
     * declines it or turns it into a contract. The same question, however it is worded, is raised once.
     */
    async raiseGap(gap: IntentGap): Promise<boolean> {
        const inserted = await this.entityManager
            .createQueryBuilder(AgentGraphProposalEntity, "proposal")
            .insert()
            .into(AgentGraphProposalEntity)
            .values({
                workspaceId: gap.workspaceId,
                agentId: gap.agentId,
                dedupeKey: gapKeyOf(gap.question),
                kind: "gap",
                baseVersionId: gap.versionId,
                nodeKey: null,
                branchKey: null,
                patch: { question: gap.question, topic: gap.topic, trigger: gap.trigger },
                widens: false,
                evidence: [],
            })
            .orIgnore()
            .execute()
        return inserted.identifiers.length > 0
    }

    /**
     * Raises the business half of a contract for the owner to approve: a task and limits, each limit citing where it came from. The same
     * content is raised once. Nothing changes until a person confirms it, and the confirm publishes it under the checks of any change.
     */
    async raiseContract(
        workspaceId: string,
        agentId: string,
        versionId: string | null,
        business: IntentBusiness,
        evidence: ReadonlyArray<string> = [],
    ): Promise<boolean> {
        const inserted = await this.entityManager
            .createQueryBuilder(AgentGraphProposalEntity, "proposal")
            .insert()
            .into(AgentGraphProposalEntity)
            .values({
                workspaceId,
                agentId,
                dedupeKey: `contract:${business.intent}:${valueHashOf(JSON.stringify(business))}`,
                kind: "contract",
                baseVersionId: versionId,
                nodeKey: null,
                branchKey: null,
                patch: { intent: business.intent, task: business.task, contract: business },
                widens: false,
                evidence: [...evidence],
            })
            .orIgnore()
            .execute()
        return inserted.identifiers.length > 0
    }

    /** Turns an open gap into a contract proposal for the owner to approve; the gap is overtaken by it. */
    async contractFromGap(
        workspaceId: string,
        agentId: string,
        gapId: string,
        business: IntentBusiness,
    ): Promise<boolean> {
        const gap = await this.entityManager.findOne(AgentGraphProposalEntity, {
            where: { id: gapId, workspaceId, agentId, status: "open", kind: "gap" },
        })
        if (gap === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })
        const raised = await this.raiseContract(workspaceId, agentId, gap.baseVersionId, business, [gapId])
        await this.supersede(workspaceId, agentId, gapId)
        return raised
    }

    /** An open contract proposal of the agent, as the business half it sets; null when it is not open or is not a contract. */
    async contractOf(workspaceId: string, agentId: string, proposalId: string): Promise<IntentBusiness | null> {
        const row = await this.entityManager.findOne(AgentGraphProposalEntity, {
            where: { id: proposalId, workspaceId, agentId, status: "open", kind: "contract" },
        })
        const parsed = intentBusinessSchema.safeParse(row?.patch.contract)
        return parsed.success ? parsed.data : null
    }

    /** The proposals still open for the agent, newest first. */
    async openOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<GraphProposalView>> {
        const rows = await this.entityManager.find(AgentGraphProposalEntity, {
            where: { workspaceId, agentId, status: "open" },
            order: { createdAt: "DESC" },
            take: PROPOSAL_LIMIT,
        })
        return rows.map(viewOf)
    }

    /** A person declines a proposal; it stays on record and is never raised again. */
    async decline(workspaceId: string, agentId: string, proposalId: string, memberId: string): Promise<void> {
        const declined = await this.entityManager.update(
            AgentGraphProposalEntity,
            { id: proposalId, workspaceId, agentId, status: "open" },
            { status: "declined", decidedBy: memberId, decidedAt: this.clock.now() },
        )
        if (declined.affected !== 1) throw new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })
    }

    /** An open proposal of the agent, as the patch it makes; null when it is not open or is not a learned one. */
    async learnedOf(workspaceId: string, agentId: string, proposalId: string): Promise<LearnedPatch | null> {
        const row = await this.entityManager.findOne(AgentGraphProposalEntity, {
            where: { id: proposalId, workspaceId, agentId, status: "open", kind: "learned" },
        })
        const { signal, amounts } = row?.patch ?? {}
        if (row?.branchKey == null || (signal !== "trust" && signal !== "reject" && signal !== "timeout")) return null
        return {
            signal,
            branchKey: row.branchKey,
            amounts: Array.isArray(amounts) ? amounts.filter((entry) => typeof entry === "number") : [],
        }
    }

    /** An open conflict of the agent, as the swap of rules it makes; null when it is not open or is not a conflict. */
    async conflictOf(workspaceId: string, agentId: string, proposalId: string): Promise<ConflictPatch | null> {
        const row = await this.entityManager.findOne(AgentGraphProposalEntity, {
            where: { id: proposalId, workspaceId, agentId, status: "open", kind: "conflict" },
        })
        const { oldFactId, newFactId, newValueHash } = row?.patch ?? {}
        if (typeof oldFactId !== "string" || typeof newFactId !== "string" || typeof newValueHash !== "string")
            return null
        return { oldFactId, newFactId, newValueHash }
    }

    /** A person confirmed a proposal; the version it made is kept with it. */
    async confirm(
        workspaceId: string,
        agentId: string,
        proposalId: string,
        memberId: string,
        versionId: string,
    ): Promise<void> {
        await this.entityManager.update(
            AgentGraphProposalEntity,
            { id: proposalId, workspaceId, agentId, status: "open" },
            { status: "confirmed", decidedBy: memberId, decidedAt: this.clock.now(), resultVersionId: versionId },
        )
    }

    /** A proposal whose branch is gone, or whose change already stands, is overtaken. */
    async supersede(workspaceId: string, agentId: string, proposalId: string): Promise<void> {
        await this.entityManager.update(
            AgentGraphProposalEntity,
            { id: proposalId, workspaceId, agentId, status: "open" },
            { status: "superseded" },
        )
    }

    /**
     * The evidence that proposals already spent, by branch and signal: an open, confirmed or declined proposal is not raised again for
     * decisions it already named, however far the window of the latest decisions has slid since.
     */
    private async spentEvidence(workspaceId: string, agentId: string): Promise<ReadonlySet<string>> {
        const rows = await this.entityManager.find(AgentGraphProposalEntity, {
            select: { branchKey: true, patch: true, evidence: true },
            where: { workspaceId, agentId, kind: "learned", status: In(["open", "confirmed", "declined"]) },
            take: SPENT_LIMIT,
        })
        return new Set(
            rows.flatMap((row) => row.evidence.map((id) => `${row.branchKey ?? ""}:${String(row.patch.signal)}:${id}`)),
        )
    }

    private async raise(
        workspaceId: string,
        agentId: string,
        versionId: string | null,
        graph: GraphDocument,
        proposal: LearnedProposal,
    ): Promise<boolean> {
        const inserted = await this.entityManager
            .createQueryBuilder(AgentGraphProposalEntity, "proposal")
            .insert()
            .into(AgentGraphProposalEntity)
            .values({
                workspaceId,
                agentId,
                dedupeKey: proposal.dedupeKey,
                kind: "learned",
                baseVersionId: versionId,
                nodeKey: nodeOfBranch(graph, proposal.branchKey),
                branchKey: proposal.branchKey,
                patch: { signal: proposal.signal, amounts: [...proposal.amounts] },
                widens: proposal.widens,
                evidence: [...proposal.evidence],
            })
            .orIgnore()
            .execute()
        return inserted.identifiers.length > 0
    }
}
