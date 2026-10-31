import { Injectable } from "@nestjs/common"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import type { GraphChangeKind, GraphDocument, GraphMode, GraphVersionView } from "./agent-graphs.contracts"
import { graphDiff } from "./policies/graph-diff.policy"
import { graphProblems } from "./policies/graph-problems.policy"

/** Who publishes. */
export interface Publisher {
    /** The member publishing. */
    readonly memberId: string
    /** Their role in the workspace: only an owner may publish a change that gives the agent more reach. */
    readonly role: WorkspaceRole
}

const EMPTY: GraphDocument = { nodes: [], rights: [] }

@Injectable()
/**
 * The only road a graph changes what an agent does. The draft is checked first (no cycle or dead end, an `else` that never runs
 * alone, no gap or overlap, nothing above the ceiling of the authority rules, every tool and datum with a right, every approver with a
 * grant), a change that widens the reach of the agent needs the owner, and the frozen version is a new row. Publishing never writes
 * a grant: the graph only narrows what the grants allow.
 */
export class AgentGraphPublishService {
    constructor(
        private readonly graphs: AgentGraphsService,
        private readonly context: AgentGraphContextService,
        private readonly installations: InstallationRecordsService,
    ) {}

    /** Publishes the draft of the agent as the next version; a publish by the owner makes the graph decide for the agent. */
    async publishDraft(
        workspaceId: string,
        agentId: string,
        by: Publisher,
        note: string,
        kind: GraphChangeKind = "edit",
    ): Promise<GraphVersionView> {
        const state = await this.requireState(workspaceId, agentId)
        const version = await this.publishDocument(state, state.draft, by, note, kind)
        if (by.role === "owner") await this.graphs.setMode(workspaceId, agentId, "enforced")
        return version
    }

    /** Publishes the graph a confirmed proposal made as the next version, under the same checks as any change (a widening is the owner's alone). */
    async publishLearned(workspaceId: string, agentId: string, document: GraphDocument, by: Publisher): Promise<GraphVersionView> {
        return this.publishDocument(await this.requireState(workspaceId, agentId), document, by, "", "learned")
    }

    /** Goes back to an older version by publishing it again as a new one, so nothing in the history changes. */
    async restore(workspaceId: string, agentId: string, versionId: string, by: Publisher): Promise<GraphVersionView> {
        const state = await this.requireState(workspaceId, agentId)
        const document = await this.graphs.documentOf(workspaceId, agentId, versionId)
        return this.publishDocument(state, document, by, "", "rollback")
    }

    /** Sets whether the graph decides or only records. Only an owner turns it to `enforced`; anyone who may edit turns it back to `shadow`. */
    setMode(workspaceId: string, agentId: string, mode: GraphMode, by: Publisher): Promise<GraphState> {
        if (mode === "enforced" && by.role !== "owner")
            return Promise.reject(new AgentGraphsError({ code: AgentGraphsErrorCode.WidensNeedsOwner }))
        return this.graphs.setMode(workspaceId, agentId, mode)
    }

    private async requireState(workspaceId: string, agentId: string): Promise<GraphState> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        if (state === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return state
    }

    private async publishDocument(
        state: GraphState,
        document: GraphDocument,
        by: Publisher,
        note: string,
        kind: GraphChangeKind,
    ): Promise<GraphVersionView> {
        const installation = await this.installations.findById(state.installationId)
        if (installation === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        const context = await this.context.contextOf({ ...state, moduleKey: installation.moduleKey }, document)
        const problems = graphProblems(document, context)
        if (problems.length > 0)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.PublishRefused, params: { count: problems.length } })
        const amountFact = Object.values(context.facts).find((spec) => spec.unit === "vnd")?.key ?? ""
        const diff = graphDiff(state.active ?? EMPTY, document, { actorMemberId: by.memberId, amountFact })
        if (diff.widens && by.role !== "owner") throw new AgentGraphsError({ code: AgentGraphsErrorCode.WidensNeedsOwner })
        return this.graphs.publish({
            workspaceId: state.workspaceId,
            agentId: state.agentId,
            document,
            kind,
            note,
            memberId: by.memberId,
            contextVersionId: null,
        })
    }
}
