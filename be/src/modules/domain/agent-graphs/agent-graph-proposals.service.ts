import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type { GraphDocument, GraphProposalView, LearnedProposal } from "./agent-graphs.contracts"
import { AgentGraphProposalEntity } from "./persistence/entities"
import { learnSignals } from "./policies/learn-signals.policy"
import type { LearnedPatch } from "./policies/proposal-patch.policy"

/** The most proposals one listing answers. */
const PROPOSAL_LIMIT = 100

const viewOf = (row: AgentGraphProposalEntity): GraphProposalView => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    nodeKey: row.nodeKey,
    branchKey: row.branchKey,
    widens: row.widens,
    evidence: row.evidence,
    createdAt: row.createdAt.toISOString(),
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
        const written = await Promise.all(learned.map((proposal) => this.raise(workspaceId, agentId, versionId, graph, proposal)))
        return written.filter(Boolean).length
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
        return { signal, branchKey: row.branchKey, amounts: Array.isArray(amounts) ? amounts.filter((entry) => typeof entry === "number") : [] }
    }

    /** A person confirmed a proposal; the version it made is kept with it. */
    async confirm(workspaceId: string, agentId: string, proposalId: string, memberId: string, versionId: string): Promise<void> {
        await this.entityManager.update(
            AgentGraphProposalEntity,
            { id: proposalId, workspaceId, agentId, status: "open" },
            { status: "confirmed", decidedBy: memberId, decidedAt: this.clock.now(), resultVersionId: versionId },
        )
    }

    /** A proposal whose branch is gone, or whose change already stands, is overtaken. */
    async supersede(workspaceId: string, agentId: string, proposalId: string): Promise<void> {
        await this.entityManager.update(AgentGraphProposalEntity, { id: proposalId, workspaceId, agentId, status: "open" }, { status: "superseded" })
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
