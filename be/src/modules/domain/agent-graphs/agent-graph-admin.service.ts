import { Injectable } from "@nestjs/common"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import type { Publisher } from "./agent-graph-publish.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphMode, GraphVersionView } from "./agent-graphs.contracts"
import { localeOf, wireOfView } from "./policies/graph-wire.policy"
import type { AgentGraphWire, OptionalLanguage } from "./policies/graph-wire.policy"

/** Who asks: the account and the workspace it acts in. */
export interface GraphActor {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The account making the request. */
    readonly principalId: string
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
