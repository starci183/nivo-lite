import { Injectable } from "@nestjs/common"
import { EntityEngineService, type ScopedTx } from "@modules/domain/entity-engine"
import type { IntentBusiness, IntentGap } from "@modules/domain/intent-contracts"
import type { UnheldRule } from "./policies/unheld-rules.policy"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type { GraphProposalView, ProposalKind } from "./agent-graphs.contracts"
import { jsonOf } from "./agent-graphs.mapper"
import type { ProposalPatch, ProposalRecord } from "./agent-graphs-records.contracts"
import { intentBusinessSchema } from "./agent-graphs.schema"
import { gapKeyOf } from "./policies/intent-gap.policy"
import type { ConflictPatch } from "./policies/conflict-patch.policy"
import { valueHashOf } from "./policies/conflict.policy"
import type { LearnedPatch } from "./policies/proposal-patch.policy"

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
const patchTextOf = (row: ProposalRecord, member: string): string | null => {
    const value = row.patch[member]
    return typeof value === "string" ? value : null
}

const viewOf = (row: ProposalRecord): GraphProposalView => ({
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

/** Whether the proposal is an open one of this agent (and of this kind, when one is named). */
const isOpenOf = (row: ProposalRecord | null, agentId: string, kind: ProposalKind | null): row is ProposalRecord =>
    row?.agentId === agentId && row.status === "open" && (kind === null || row.kind === kind)

const notFound = (): AgentGraphsError => new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })

@Injectable()
/**
 * What the graph proposes to its owner. Learning only proposes: it reads closed decisions in code, with no model, and raises a
 * proposal that lists the decisions as evidence; no version changes until a person confirms it. A proposal whose branch is gone
 * is superseded, and the same cause never raises two proposals (the dedupe key is unique for the agent).
 */
export class AgentGraphProposalsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly records: AgentGraphRecordsService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Raises the proposal that a newer rule of the Brain replaced the one a node cites; the same replacement is raised once. */
    raiseConflict(workspaceId: string, agentId: string, versionId: string, conflict: ConflictRaised): Promise<boolean> {
        return this.engine.scoped(workspaceId, (tx) =>
            this.records.raiseProposal(tx, {
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
                evidence: { ids: [conflict.oldFactId, conflict.newFactId] },
            }),
        )
    }

    /**
     * Raises the gap a turn found: the work nothing in the published graph fits. It is informational, so it changes nothing; the owner
     * declines it or turns it into a contract. The same question, however it is worded, is raised once.
     */
    raiseGap(gap: IntentGap): Promise<boolean> {
        return this.engine.scoped(gap.workspaceId, (tx) =>
            this.records.raiseProposal(tx, {
                agentId: gap.agentId,
                dedupeKey: gapKeyOf(gap.question),
                kind: "gap",
                baseVersionId: gap.versionId,
                nodeKey: null,
                branchKey: null,
                patch: {
                    question: gap.question,
                    topic: gap.topic,
                    trigger: gap.trigger,
                    ...(gap.amountVnd === undefined ? {} : { amount_vnd: gap.amountVnd }),
                },
                widens: false,
                evidence: { ids: [] },
            }),
        )
    }

    /**
     * Raises the business half of a contract for the owner to approve: a task and limits, each limit citing where it came from. The same
     * content is raised once. Nothing changes until a person confirms it, and the confirm publishes it under the checks of any change.
     */
    raiseContract(
        workspaceId: string,
        agentId: string,
        versionId: string | null,
        business: IntentBusiness,
        evidence: ReadonlyArray<string> = [],
    ): Promise<boolean> {
        return this.engine.scoped(workspaceId, (tx) =>
            this.records.raiseProposal(tx, {
                agentId,
                dedupeKey: `contract:${business.intent}:${valueHashOf(JSON.stringify(business))}`,
                kind: "contract",
                baseVersionId: versionId,
                nodeKey: null,
                branchKey: null,
                patch: { intent: business.intent, task: business.task, contract: jsonOf(business) },
                widens: false,
                evidence: { ids: [...evidence] },
            }),
        )
    }

    /** Turns an open gap into a contract proposal for the owner to approve; the gap is overtaken by it. */
    async contractFromGap(
        workspaceId: string,
        agentId: string,
        gapId: string,
        business: IntentBusiness,
    ): Promise<boolean> {
        const gap = await this.openProposal(workspaceId, agentId, gapId, "gap")
        if (gap === null) throw notFound()
        const raised = await this.raiseContract(workspaceId, agentId, gap.baseVersionId, business, [gapId])
        await this.supersede(workspaceId, agentId, gapId)
        return raised
    }

    /** An open contract proposal of the agent, as the business half it sets; null when it is not open or is not a contract. */
    async contractOf(workspaceId: string, agentId: string, proposalId: string): Promise<IntentBusiness | null> {
        const row = await this.openProposal(workspaceId, agentId, proposalId, "contract")
        const parsed = intentBusinessSchema.safeParse(row?.patch["contract"])
        return parsed.success ? parsed.data : null
    }

    /** The proposals still open for the agent, newest first. */
    openOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<GraphProposalView>> {
        return this.engine.scoped(workspaceId, async (tx) =>
            (await this.records.openProposalsOf(tx, agentId, PROPOSAL_LIMIT)).map(viewOf),
        )
    }

    /**
     * The rules of the setup text that were raised as gaps and are still open: each gap that carries the sum it is about, with the
     * sentence that states it. Read from the stored proposals, so a view makes no model call and reads no words.
     */
    unheldOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<UnheldRule>> {
        return this.engine.scoped(workspaceId, async (tx) =>
            (await this.records.openProposalsOf(tx, agentId, PROPOSAL_LIMIT)).flatMap((row) => {
                const amountVnd = row.patch["amount_vnd"]
                const quote = patchTextOf(row, "question")
                return row.kind === "gap" && typeof amountVnd === "number" && quote !== null ? [{ amountVnd, quote }] : []
            }),
        )
    }

    /** A person declines a proposal; it stays on record and is never raised again. */
    async decline(workspaceId: string, agentId: string, proposalId: string, memberId: string): Promise<void> {
        const declined = await this.settle(workspaceId, agentId, proposalId, {
            status: "declined",
            decidedBy: memberId,
            decidedAt: this.clock.now().toISOString(),
        })
        if (!declined) throw notFound()
    }

    /** An open proposal of the agent, as the patch it makes; null when it is not open or is not a learned one. */
    async learnedOf(workspaceId: string, agentId: string, proposalId: string): Promise<LearnedPatch | null> {
        const row = await this.openProposal(workspaceId, agentId, proposalId, "learned")
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
        const row = await this.openProposal(workspaceId, agentId, proposalId, "conflict")
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
        await this.settle(workspaceId, agentId, proposalId, {
            status: "confirmed",
            decidedBy: memberId,
            decidedAt: this.clock.now().toISOString(),
            resultVersionId: versionId,
        })
    }

    /** A proposal whose branch is gone, or whose change already stands, is overtaken. */
    async supersede(workspaceId: string, agentId: string, proposalId: string): Promise<void> {
        await this.settle(workspaceId, agentId, proposalId, { status: "superseded" })
    }

    /** The open proposal of that agent and kind, or null. */
    private openProposal(
        workspaceId: string,
        agentId: string,
        proposalId: string,
        kind: ProposalKind,
    ): Promise<ProposalRecord | null> {
        return this.engine.scoped(workspaceId, (tx) => this.openIn(tx, agentId, proposalId, kind))
    }

    private async openIn(
        tx: ScopedTx,
        agentId: string,
        proposalId: string,
        kind: ProposalKind | null,
    ): Promise<ProposalRecord | null> {
        const row = await this.records.proposal(tx, proposalId)
        return isOpenOf(row, agentId, kind) ? row : null
    }

    /** Writes the change to an open proposal of the agent; false when there is none open or it changed meanwhile. */
    private settle(
        workspaceId: string,
        agentId: string,
        proposalId: string,
        values: ProposalPatch,
    ): Promise<boolean> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const row = await this.openIn(tx, agentId, proposalId, null)
            return row !== null && (await this.records.patchProposal(tx, row, values)) !== null
        })
    }
}
