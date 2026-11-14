import { Injectable, Optional } from "@nestjs/common"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphRightsService } from "./agent-graph-rights.service"
import { AgentRightsRecordsService } from "./agent-rights-records.service"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService, type GraphState, type PublishInput } from "./agent-graphs.service"
import type { GraphChangeKind, GraphDocument, GraphMode, GraphVersionView } from "./agent-graphs.contracts"
import { graphDiff } from "./policies/graph-diff.policy"
import { flowChanged, requireSoundFlow } from "./policies/flow.policy"
import { graphProblems } from "./policies/graph-problems.policy"
import type { AgreedRight, RightsSettlement } from "./policies/node-rights-gate.policy"

/** Who publishes. */
export interface Publisher {
    /** The member publishing. */
    readonly memberId: string
    /** Their role in the workspace: only an owner may publish a change that gives the agent more reach. */
    readonly role: WorkspaceRole
}

/** How one document is published: by whom, as what kind of change, and what the owner agreed about rights. */
interface Publication {
    readonly by: Publisher
    readonly note: string
    readonly kind: GraphChangeKind
    readonly contextVersionId?: string | null | undefined
    readonly versionNumber?: number | undefined
    readonly agreed: ReadonlyArray<AgreedRight>
    readonly unagreed?: UnagreedRights | undefined
}

/**
 * What a copy's publish does with rights the owner has not agreed: `refuse` (the default: the refusal lists them and
 * the same call with the list passes), or `wait` for the road that made the agent in the same call (a setup copy), where a refusal would leave a made agent nobody can finish: the version is published and the entries wait for the owner.
 */
export type UnagreedRights = "refuse" | "wait"

/** The version of the context the change was made against, or null when it was made against none. */
export type OptionalBasisVersionId = string | null

const EMPTY: GraphDocument = { nodes: [] }

/** No entry agreed: what a road sends when the owner was not asked about rights. */
const NOTHING_AGREED: ReadonlyArray<AgreedRight> = []

@Injectable()
/**
 * The only road a graph changes what an agent does. The draft is checked first (no cycle or dead end, an `else` that never runs
 * alone, no gap or overlap, every tool and datum with a right, a node graph whose spec the installed nodes take), a change that widens the reach of the agent or changes its node graph
 * needs the owner, and the frozen version is a new row. Publishing never writes
 * a grant of a tool or a datum: the graph only narrows what the grants allow. What the nodes of the flow ask for on the agent's
 * connected accounts passes the rights gate (`AgentGraphRightsService`): asking for more than the primary workflow holds activates
 * only with the owner's agreed list, whose entries become grant rows IN THE TRANSACTION OF THE VERSION (both or neither). The rows
 * name no version there (the workflow version that mirrors the graph version is made by the adoption, after it) and are named it
 * once afterwards; a row that is never named one grants all the same.
 */
export class AgentGraphPublishService {
    constructor(
        private readonly graphs: AgentGraphsService,
        private readonly context: AgentGraphContextService,
        private readonly installations: InstallationRecordsService,
        private readonly nodes: GraphNodeRegistryService,
        @Optional() private readonly rights?: AgentGraphRightsService,
        @Optional() private readonly adoption?: AgentWorkflowAdoptionService,
        @Optional() private readonly rows?: AgentRightsRecordsService,
    ) {}

    /**
     * Publishes the draft of the agent as the next version, or as the number given when the setup numbers both of its rows. The mode stays
     * as it is: a graph is enforced unless the owner set it to shadow.
     */
    async publishDraft(
        workspaceId: string,
        agentId: string,
        by: Publisher,
        note: string,
        kind: GraphChangeKind = "edit",
        contextVersionId: OptionalBasisVersionId = null,
        versionNumber?: number,
        agreed: ReadonlyArray<AgreedRight> = NOTHING_AGREED,
    ): Promise<GraphVersionView> {
        const state = await this.requireState(workspaceId, agentId)
        return this.publishDocument(state, state.draft, { by, note, kind, contextVersionId, versionNumber, agreed })
    }

    /** Refuses, writing nothing, when publishing the draft would be refused: a problem in the graph, or a widening by someone who is not the owner. */
    async requirePublishable(workspaceId: string, agentId: string, by: Publisher): Promise<void> {
        const state = await this.requireState(workspaceId, agentId)
        await this.checked(state, state.draft, by)
        await this.rightsOf(state, state.draft, { by, note: "", kind: "edit", agreed: NOTHING_AGREED })
    }

    /** Publishes the graph a confirmed proposal made as the next version, under the same checks as any change (a widening is the owner's alone). */
    async publishLearned(
        workspaceId: string,
        agentId: string,
        document: GraphDocument,
        by: Publisher,
        agreed: ReadonlyArray<AgreedRight> = NOTHING_AGREED,
    ): Promise<GraphVersionView> {
        const state = await this.requireState(workspaceId, agentId)
        return this.publishDocument(state, document, { by, note: "", kind: "learned", agreed })
    }

    /** Publishes the graph a confirmed contract proposal made as the next version (a change made in the setup chat), under the same checks as any change. */
    async publishContract(
        workspaceId: string,
        agentId: string,
        document: GraphDocument,
        by: Publisher,
        agreed: ReadonlyArray<AgreedRight> = NOTHING_AGREED,
    ): Promise<GraphVersionView> {
        const state = await this.requireState(workspaceId, agentId)
        return this.publishDocument(state, document, { by, note: "", kind: "chat", agreed })
    }

    /** Publishes the graph a confirmed Brain conflict made as the next version, under the same checks as any change. */
    async publishConflict(
        workspaceId: string,
        agentId: string,
        document: GraphDocument,
        by: Publisher,
        agreed: ReadonlyArray<AgreedRight> = NOTHING_AGREED,
    ): Promise<GraphVersionView> {
        const state = await this.requireState(workspaceId, agentId)
        return this.publishDocument(state, document, { by, note: "", kind: "conflict", agreed })
    }

    /**
     * Publishes the graph a sibling agent of the same role runs as the next version of a new agent ("copy the setup of"), under the same
     * checks as any change, and a widening only by the owner.
     */
    async publishCopy(
        workspaceId: string,
        agentId: string,
        document: GraphDocument,
        by: Publisher,
        agreed: ReadonlyArray<AgreedRight> = NOTHING_AGREED,
        unagreed: UnagreedRights = "refuse",
    ): Promise<GraphVersionView> {
        const state = await this.requireState(workspaceId, agentId)
        return this.publishDocument(state, document, { by, note: "", kind: "copy", agreed, unagreed })
    }

    /** Goes back to an older version by publishing it again as a new one, so nothing in the history changes. */
    async restore(
        workspaceId: string,
        agentId: string,
        versionId: string,
        by: Publisher,
        agreed: ReadonlyArray<AgreedRight> = NOTHING_AGREED,
    ): Promise<GraphVersionView> {
        const state = await this.requireState(workspaceId, agentId)
        const document = await this.graphs.documentOf(workspaceId, agentId, versionId)
        return this.publishDocument(state, document, { by, note: "", kind: "rollback", agreed })
    }

    /** Sets whether the graph decides or only records. Only the owner does, either way: turning a graph off widens what the agent may do. */
    setMode(workspaceId: string, agentId: string, mode: GraphMode, by: Publisher): Promise<GraphState> {
        if (by.role !== "owner")
            return Promise.reject(new AgentGraphsError({ code: AgentGraphsErrorCode.WidensNeedsOwner }))
        return this.graphs.setMode(workspaceId, agentId, mode, by.memberId)
    }

    private async requireState(workspaceId: string, agentId: string): Promise<GraphState> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        if (state === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return state
    }

    private async publishDocument(
        state: GraphState,
        document: GraphDocument,
        how: Publication,
    ): Promise<GraphVersionView> {
        await this.checked(state, document, how.by)
        const settled = await this.rightsOf(state, document, how)
        const { workspaceId, agentId } = state
        const input: PublishInput = {
            workspaceId,
            agentId,
            document,
            kind: how.kind,
            note: how.note,
            memberId: how.by.memberId,
            contextVersionId: how.contextVersionId ?? null,
            version: how.versionNumber,
        }
        const { rows } = this
        if (rows === undefined || settled === undefined || settled.grants.length === 0)
            return this.graphs.publish(input)
        const { workflowId } = settled
        // The rows are keyed by the primary workflow. The first flow of an agent has none until the version is adopted, so there
        // (and only there) the rows follow the adoption, in a transaction of their own: a failure leaves the entries waiting for
        // the owner, never granted without a row.
        if (workflowId === null) {
            const version = await this.graphs.publish(input)
            await this.adoption?.adoptAgentGraph(workspaceId, agentId)
            await rows.record(workspaceId, settled, await this.mirrorOf(state, version))
            return version
        }
        // With a primary workflow, the version and the rows agreed for it are ONE transaction: both commit or neither does. The
        // rows name no version in it, because the workflow version that mirrors this graph version is only made by the adoption.
        const version = await rows.run(
            workspaceId,
            settled,
            (tx) => this.graphs.publishIn(tx, input),
            () => ({ workflowId, versionId: null }),
        )
        // The provenance stamp, after the commit: it never fails the publish (see `stampOnce` for the retry, its bound and the
        // report to the founder when it is given up).
        const mirror = async (): Promise<string | null> => {
            await this.adoption?.adoptAgentGraph(workspaceId, agentId)
            return this.mirrorOf(state, version)
        }
        await rows.stampOnce(workspaceId, settled, mirror, version.id)
        return version
    }

    /** The workflow version that mirrors a graph version, or null when none does: a row never names a graph version. */
    private async mirrorOf(state: GraphState, version: GraphVersionView): Promise<string | null> {
        const mirror = await this.graphs.workflowVersionIdOf(state.workspaceId, state.agentId, version.id)
        return mirror === version.id ? null : mirror
    }

    /**
     * What the rights gate settles for the flow of a document: nothing for a document with no flow, or when neither the flow nor the
     * one that runs states an account (a graph from before node rights is not judged). A template or a copy brings what the agent's
     * ticks grant today; anything more, on any road, needs the owner's agreed list, and the gate refuses otherwise.
     */
    private async rightsOf(
        state: GraphState,
        document: GraphDocument,
        how: Publication,
    ): Promise<RightsSettlement | undefined> {
        const after = document.flow
        const before = state.active?.flow ?? null
        if (this.rights === undefined || after === undefined) return undefined
        const { workspaceId, agentId } = state
        return this.rights.decide({
            workspaceId,
            agentId,
            workflowId: (await this.rows?.primaryOf(workspaceId, agentId)) ?? null,
            before,
            after,
            consent: { memberId: how.by.memberId, role: how.by.role, agreed: how.agreed },
            byTemplate: how.kind === "template" || how.kind === "copy",
            waits: how.unagreed === "wait",
        })
    }

    private async checked(state: GraphState, document: GraphDocument, by: Publisher): Promise<void> {
        const installation = await this.installations.findById(state.installationId)
        if (installation === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        const context = await this.context.contextOf({ ...state, moduleKey: installation.moduleKey })
        if (document.flow !== undefined) requireSoundFlow(document.flow, this.nodes.installed())
        const problems = graphProblems(document, context)
        if (problems.length > 0)
            throw new AgentGraphsError({
                code: AgentGraphsErrorCode.PublishRefused,
                params: { count: problems.length },
            })
        const diff = graphDiff(state.active ?? EMPTY, document, { actorMemberId: by.memberId, facts: context.facts })
        if ((diff.widens || flowChanged(state.active?.flow, document.flow)) && by.role !== "owner")
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.WidensNeedsOwner })
    }
}
