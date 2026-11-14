import { Injectable } from "@nestjs/common"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { IntentBusiness } from "@modules/domain/intent-contracts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphPublishService, type Publisher } from "./agent-graph-publish.service"
import type { AgreedRightRequest } from "./agent-workflows-door.contracts"
import { agreedRightsOf, type AgreedRight } from "./policies/node-rights-gate.policy"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService, type GraphState } from "./agent-graphs.service"
import type { GraphDocument, GraphMode, GraphVersionView } from "./agent-graphs.contracts"
import { applyConflict, type ConflictPatch } from "./policies/conflict-patch.policy"
import { applyContract } from "./policies/contract-patch.policy"
import { requireKnownModels } from "./policies/graph-models.policy"
import {
    localeOf,
    wireOfView,
    type AgentGraphRunWire,
    type AgentGraphWire,
    type OptionalLanguage,
} from "./policies/graph-wire.policy"
import { applyLearned } from "./policies/proposal-patch.policy"

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

/** The person confirming a proposal, with what the owner agreed about the rights the confirmed graph asks for. */
interface Confirmer {
    readonly by: Publisher
    readonly agreed: ReadonlyArray<AgreedRight>
}

/** The entries the owner agreed, as the last argument of a publish: none when nothing was agreed. */
const agreedArgs = (agreed: ReadonlyArray<AgreedRight>): [] | [ReadonlyArray<AgreedRight>] =>
    agreed.length === 0 ? [] : [agreed]

/** Who can answer one ask of the graph, and who was left out: the shape the coverage door still answers (always empty). */
export interface AskCoverage {
    /** The node that asks. */
    readonly nodeKey: string
    /** The branch that asks, or null for an approval step. */
    readonly branchKey: string | null
    /** The top of the amounts the branch covers, or null when it has none. */
    readonly top: number | null
    /** The names of the people a request would go to. */
    readonly approvers: ReadonlyArray<string>
    /** The people of the group left out, with the reason. */
    readonly excluded: ReadonlyArray<{ readonly name: string; readonly reason: string }>
    /** False when nobody can approve up to the top of the branch. */
    readonly covered: boolean
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
        const document = parsed(documentJson)
        // A node's model (the drawer's picker) must be Auto or a model of the vocabulary, on a node that calls AI.
        requireKnownModels(document)
        return (await this.graphs.saveDraft(actor.workspaceId, agentId, rev, document)).draftRev
    }

    /** Publishes the draft as the next version. */
    async publish(
        actor: GraphActor,
        agentId: string,
        note: string,
        agreedRights?: ReadonlyArray<AgreedRightRequest> | null,
    ): Promise<GraphVersionView> {
        const agreed = agreedRightsOf(agreedRights)
        const by = await this.publisherOf(actor)
        if (agreed.length === 0) return this.publishing.publishDraft(actor.workspaceId, agentId, by, note)
        return this.publishing.publishDraft(actor.workspaceId, agentId, by, note, "edit", null, undefined, agreed)
    }

    /** Publishes an older version again as a new one. */
    async restore(
        actor: GraphActor,
        agentId: string,
        versionId: string,
        agreedRights?: ReadonlyArray<AgreedRightRequest> | null,
    ): Promise<GraphVersionView> {
        const agreed = agreedRightsOf(agreedRights)
        const by = await this.publisherOf(actor)
        return this.publishing.restore(actor.workspaceId, agentId, versionId, by, ...agreedArgs(agreed))
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
    async confirm(
        actor: GraphActor,
        agentId: string,
        proposalId: string,
        agreedRights?: ReadonlyArray<AgreedRightRequest> | null,
    ): Promise<GraphVersionView> {
        const agreed = agreedRightsOf(agreedRights)
        const by = await this.publisherOf(actor)
        const contract = await this.proposals.contractOf(actor.workspaceId, agentId, proposalId)
        if (contract !== null) return this.confirmContract(actor, agentId, { by, agreed }, proposalId, contract)
        const [patch, conflict, state] = await Promise.all([
            this.proposals.learnedOf(actor.workspaceId, agentId, proposalId),
            this.proposals.conflictOf(actor.workspaceId, agentId, proposalId),
            this.graphs.stateOfAgent(actor.workspaceId, agentId),
        ])
        if (state?.active != null && conflict !== null)
            return this.confirmConflict(actor, { by, agreed }, proposalId, conflict, { state, active: state.active })
        if (patch === null || state?.active == null)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })
        const document = applyLearned(state.active, patch)
        if (document === null) {
            await this.proposals.supersede(actor.workspaceId, agentId, proposalId)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })
        }
        const version = await this.publishing.publishLearned(
            actor.workspaceId,
            agentId,
            document,
            by,
            ...agreedArgs(agreed),
        )
        await this.proposals.confirm(actor.workspaceId, agentId, proposalId, by.memberId, version.id)
        return version
    }

    /**
     * Confirms a contract proposal: the business half of the intent is set in the graph that decides and published as the next version,
     * and the owner's unpublished edits of the draft stay, with the same contract in them. A contract the graph already holds is overtaken.
     */
    private async confirmContract(
        actor: GraphActor,
        agentId: string,
        confirmer: Confirmer,
        proposalId: string,
        business: IntentBusiness,
    ): Promise<GraphVersionView> {
        const { by, agreed } = confirmer
        const { workspaceId } = actor
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        const document = state?.active == null ? null : applyContract(state.active, business)
        if (state?.active == null || document === null) {
            await this.proposals.supersede(workspaceId, agentId, proposalId)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })
        }
        const version = await this.publishing.publishContract(workspaceId, agentId, document, by, ...agreedArgs(agreed))
        await this.proposals.confirm(workspaceId, agentId, proposalId, by.memberId, version.id)
        if (JSON.stringify(state.draft) !== JSON.stringify(state.active)) {
            const now = await this.graphs.stateOfAgent(workspaceId, agentId)
            const kept = applyContract(state.draft, business) ?? state.draft
            if (now !== null) await this.graphs.saveDraft(workspaceId, agentId, now.draftRev, kept)
        }
        return version
    }

    /** Turns a gap into a contract proposal: the owner states the task and limits, and the gap is overtaken by it. */
    async contractFromGap(actor: GraphActor, agentId: string, gapId: string, business: IntentBusiness): Promise<void> {
        await this.publisherOf(actor)
        await this.proposals.contractFromGap(actor.workspaceId, agentId, gapId, business)
    }

    /**
     * Confirms a Brain conflict: every place the running graph cited the replaced rule cites the rule in force, and that is published as
     * the next version. The owner's unpublished edits stay in the draft, with the same swap, so confirming costs them nothing.
     */
    private async confirmConflict(
        actor: GraphActor,
        confirmer: Confirmer,
        proposalId: string,
        conflict: ConflictPatch,
        graph: ConflictGraph,
    ): Promise<GraphVersionView> {
        const { workspaceId } = actor
        const { by, agreed } = confirmer
        const { state, active } = graph
        const agentId = state.agentId
        const fact = await this.brain.get(workspaceId, conflict.newFactId)
        const swapped = fact === null ? null : applyConflict(active, conflict, fact.value)
        if (fact === null || swapped === null) {
            await this.proposals.supersede(workspaceId, agentId, proposalId)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.ProposalNotFound })
        }
        const version = await this.publishing.publishConflict(workspaceId, agentId, swapped, by, ...agreedArgs(agreed))
        await this.proposals.confirm(workspaceId, agentId, proposalId, by.memberId, version.id)
        if (JSON.stringify(state.draft) !== JSON.stringify(active)) {
            const now = await this.graphs.stateOfAgent(workspaceId, agentId)
            const kept = applyConflict(state.draft, conflict, fact.value) ?? state.draft
            if (now !== null) await this.graphs.saveDraft(workspaceId, agentId, now.draftRev, kept)
        }
        return version
    }

    /**
     * The trace of the run of a work item through the graph: none exists. No engine gate walks a graph (2026-11-13), so no graph decision is
     * written; the door stays for the screen that still asks and answers not found.
     */
    async run(actor: GraphActor, _workItemId: string): Promise<AgentGraphRunWire> {
        await this.publisherOf(actor)
        throw new AgentGraphsError({ code: AgentGraphsErrorCode.RunNotFound })
    }

    /**
     * Who can answer each ask of the draft graph: none is computed. The coverage read the approvers' grants for an authority action, and
     * the rules decide nothing since the engine gate was removed (2026-11-13); the door stays for the screen that still asks.
     */
    async coverage(actor: GraphActor, _agentId: string): Promise<ReadonlyArray<AskCoverage>> {
        await this.publisherOf(actor)
        return []
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
