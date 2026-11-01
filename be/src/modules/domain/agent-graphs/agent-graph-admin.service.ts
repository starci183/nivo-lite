import { Injectable } from "@nestjs/common"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { AgentGraphContextService } from "./agent-graph-context.service"
import type { AskCoverage } from "./agent-graph-context.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import type { Publisher } from "./agent-graph-publish.service"
import { AgentGraphRunService } from "./agent-graph-run.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphDocument, GraphMode, GraphVersionView } from "./agent-graphs.contracts"
import type { GraphState } from "./agent-graphs.service"
import { applyConflict } from "./policies/conflict-patch.policy"
import type { ConflictPatch } from "./policies/conflict-patch.policy"
import { localeOf, wireOfView } from "./policies/graph-wire.policy"
import { applyLearned } from "./policies/proposal-patch.policy"
import type { AgentGraphRunWire, AgentGraphWire, OptionalLanguage } from "./policies/graph-wire.policy"

/** Who asks: the account and the workspace it acts in. */
export interface GraphActor {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The account making the request. */
    readonly principalId: string
}

/** The graph a conflict is confirmed on: its state, and the version that decides. */
interface ConflictGraph {
    readonly state: GraphState
    readonly active: GraphDocument
}

/** The text of a graph the editor sent, read as data; a text that is not JSON is a graph that cannot be read. */
const parsed = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch (error) {
        throw new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid, cause: error })
    }
}

@Injectable()
/**
 * The door of the graph editor: every call checks that the account holds an active seat as owner or manager of the workspace, then
 * reads or changes the graph of one agent. The first open of an agent seeds its graph, so the editor never meets an agent with none.
 */
export class AgentGraphAdminService {
    constructor(
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly graphs: AgentGraphsService,
        private readonly seed: AgentGraphSeedService,
        private readonly view: AgentGraphViewService,
        private readonly publishing: AgentGraphPublishService,
        private readonly proposals: AgentGraphProposalsService,
        private readonly installations: InstallationRecordsService,
        private readonly running: AgentGraphRunService,
        private readonly context: AgentGraphContextService,
        private readonly brain: BrainFactsService,
    ) {}

    /** The graph of the agent for the editor, seeded on the first open. */
    async open(actor: GraphActor, agentId: string, language: OptionalLanguage): Promise<AgentGraphWire> {
        const locale = localeOf(language)
        await this.publisherOf(actor)
        if ((await this.graphs.stateOfAgent(actor.workspaceId, agentId)) === null) {
            const installation = await this.installations.ofAgent(actor.workspaceId, agentId)
            if (installation !== null) await this.seed.ensureFor(installation.id, locale)
        }
        return wireOfView(await this.view.viewOf(actor.workspaceId, agentId, locale))
    }

    /** The versions of the agent, newest first. */
    async versions(actor: GraphActor, agentId: string): Promise<ReadonlyArray<GraphVersionView>> {
        await this.publisherOf(actor)
        return this.graphs.versionsOf(actor.workspaceId, agentId)
    }

    /** Saves the draft the editor read at `rev`; answers the new revision. */
    async saveDraft(actor: GraphActor, agentId: string, rev: number, documentJson: string): Promise<number> {
        await this.publisherOf(actor)
        return (await this.graphs.saveDraft(actor.workspaceId, agentId, rev, parsed(documentJson))).draftRev
    }

    /** Publishes the draft as the next version. */
    async publish(actor: GraphActor, agentId: string, note: string): Promise<GraphVersionView> {
        return this.publishing.publishDraft(actor.workspaceId, agentId, await this.publisherOf(actor), note)
    }

    /** Publishes an older version again as a new one. */
    async restore(actor: GraphActor, agentId: string, versionId: string): Promise<GraphVersionView> {
        return this.publishing.restore(actor.workspaceId, agentId, versionId, await this.publisherOf(actor))
    }

    /** Sets whether the graph decides or only records. */
    async setMode(actor: GraphActor, agentId: string, mode: GraphMode): Promise<void> {
        await this.publishing.setMode(actor.workspaceId, agentId, mode, await this.publisherOf(actor))
    }

    /**
     * Confirms a learned proposal: makes the change it proposes to the graph that decides and publishes it as the next version. A
     * proposal whose change no longer applies (the branch is gone, the boundary already stands there) is overtaken, and a change that
     * widens what the agent may do is the owner's alone.
     */
    async confirm(actor: GraphActor, agentId: string, proposalId: string): Promise<GraphVersionView> {
        const by = await this.publisherOf(actor)
        const [patch, conflict, state] = await Promise.all([
            this.proposals.learnedOf(actor.workspaceId, agentId, proposalId),
            this.proposals.conflictOf(actor.workspaceId, agentId, proposalId),
            this.graphs.stateOfAgent(actor.workspaceId, agentId),
        ])
        if (state?.active != null && conflict !== null) return this.confirmConflict(actor, by, proposalId, conflict, { state, active: state.active })
        if (patch === null || state?.active == null)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })
        const document = applyLearned(state.active, patch)
        if (document === null) {
            await this.proposals.supersede(actor.workspaceId, agentId, proposalId)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })
        }
        const version = await this.publishing.publishLearned(actor.workspaceId, agentId, document, by)
        await this.proposals.confirm(actor.workspaceId, agentId, proposalId, by.memberId, version.id)
        return version
    }

    /**
     * Confirms a Brain conflict: every place the running graph cited the replaced rule cites the rule in force, and that is published as
     * the next version. The owner's unpublished edits stay in the draft, with the same swap, so confirming costs them nothing.
     */
    private async confirmConflict(
        actor: GraphActor,
        by: Publisher,
        proposalId: string,
        conflict: ConflictPatch,
        graph: ConflictGraph,
    ): Promise<GraphVersionView> {
        const { workspaceId } = actor
        const { state, active } = graph
        const agentId = state.agentId
        const fact = await this.brain.get(workspaceId, conflict.newFactId)
        const swapped = fact === null ? null : applyConflict(active, conflict, fact.value)
        if (fact === null || swapped === null) {
            await this.proposals.supersede(workspaceId, agentId, proposalId)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })
        }
        const version = await this.publishing.publishConflict(workspaceId, agentId, swapped, by)
        await this.proposals.confirm(workspaceId, agentId, proposalId, by.memberId, version.id)
        if (JSON.stringify(state.draft) !== JSON.stringify(active)) {
            const now = await this.graphs.stateOfAgent(workspaceId, agentId)
            const kept = applyConflict(state.draft, conflict, fact.value) ?? state.draft
            if (now !== null) await this.graphs.saveDraft(workspaceId, agentId, now.draftRev, kept)
        }
        return version
    }

    /** The trace of the run of a work item through the graph. */
    async run(actor: GraphActor, workItemId: string): Promise<AgentGraphRunWire> {
        await this.publisherOf(actor)
        return this.running.runOf(actor.workspaceId, workItemId)
    }

    /** Who can answer each ask of the draft graph. An agent without a graph has no asks, so its coverage is empty. */
    async coverage(actor: GraphActor, agentId: string): Promise<ReadonlyArray<AskCoverage>> {
        await this.publisherOf(actor)
        const state = await this.graphs.stateOfAgent(actor.workspaceId, agentId)
        if (state === null) return []
        const installation = await this.installations.findById(state.installationId)
        if (installation === null)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return this.context.coverageOf({ ...state, moduleKey: installation.moduleKey }, state.draft)
    }

    /** Declines a proposal. */
    async decline(actor: GraphActor, agentId: string, proposalId: string): Promise<void> {
        const by = await this.publisherOf(actor)
        await this.proposals.decline(actor.workspaceId, agentId, proposalId, by.memberId)
    }

    private async publisherOf(actor: GraphActor): Promise<Publisher> {
        const seat = await this.seats.activeSeatOfUser(actor.workspaceId, actor.principalId)
        if (seat === null || (seat.role !== "owner" && seat.role !== "manager"))
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.Forbidden })
        return { memberId: seat.memberId, role: seat.role }
    }
}
