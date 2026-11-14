import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import { EntityEngineService, type ScopedTx, type ScopedWork } from "@modules/domain/entity-engine"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentGraphRightsService } from "./agent-graph-rights.service"
import { AgentRightsRecordsService } from "./agent-rights-records.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowStoreService, WORKFLOW_LIMIT } from "./agent-workflow-store.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import type { GraphVersionView } from "./agent-graphs.contracts"
import type {
    AdoptedVersion,
    OptionalWorkflowId,
    VersionWrite,
    WorkflowAuthor,
    WorkflowCopy,
    WorkflowRecord,
} from "./agent-workflows.contracts"
import { noRights, settledOr, type RightsSettlement } from "./policies/node-rights-gate.policy"
import { sameJson } from "./policies/workflow-diff.policy"
import {
    adoptedAuthorOf,
    adoptedKindOf,
    closestLinkOf,
    snapshotHashOf,
    snapshotOf,
    workflowNotFound,
} from "./policies/workflow-view.policy"

/** The most agent graph versions an adoption copies into the primary workflow's history. */
const ADOPT_LIMIT = 20

/** The key of a primary workflow made from an agent graph of a module with no primary template. */
const MAIN_KEY = "main"

/** Where the primary workflow stands against the agent graph version that decides. */
interface PrimaryStanding {
    readonly primary: WorkflowRecord | null
    readonly synced: boolean
}

/** A workflow a copy or an adoption made, with the version it runs and the workflow it came from. */
interface CopiedWorkflow {
    readonly sourceId: string
    readonly workflowId: string
    readonly versionId: string
}

/** The agent graph that decides: its version id and its flow. */
interface ActiveGraph {
    readonly versionId: string
    readonly flow: GraphSpec
}

@Injectable()
/**
 * Keeps the primary workflow of an agent in step with the agent's own graph (adopting it, with its history, when the agent has no
 * workflow yet; appending a version when the graph was published elsewhere), and copies the workflows of one installation's agent to
 * another's. Adopted versions keep their kind, author and time; each carries as provenance the template version it is closest to.
 * No person walks these roads, so the rights gate never refuses here: the version that runs brings the grant rows the agent's ticks
 * already give it (nothing changes for the workspace), and what it asks beyond them waits for the owner.
 */
export class AgentWorkflowAdoptionService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly records: AgentWorkflowRecordsService,
        private readonly store: AgentWorkflowStoreService,
        private readonly graphs: AgentGraphsService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly installations?: InstallationRecordsService,
        @Optional() private readonly rights?: AgentGraphRightsService,
        @Optional() private readonly rows?: AgentRightsRecordsService,
    ) {}

    /**
     * Makes the agent's own graph its primary workflow when it has none, or brings the primary workflow up to the agent graph version
     * that decides when someone published that version elsewhere (the graph editor, a confirmed proposal, a seed). A graph with no flow
     * adopts nothing. Answers the primary workflow's id, or null.
     */
    async adoptAgentGraph(workspaceId: string, agentId: string): Promise<OptionalWorkflowId> {
        const active = await this.activeOf(workspaceId, agentId)
        if (active === null) return null
        const standing = await this.engine.scoped(workspaceId, (tx) => this.standingOf(tx, agentId, active.versionId))
        if (standing.synced) return standing.primary?.id ?? null
        const versions = await this.graphs.versionsOf(workspaceId, agentId)
        if (standing.primary !== null) return this.catchUp(workspaceId, standing.primary, versions, active)
        const adopted = await this.flowsOf(workspaceId, agentId, versions.slice(0, ADOPT_LIMIT).toReversed())
        return adopted.length === 0 ? null : this.adoptAll(workspaceId, agentId, adopted)
    }

    /** The templates of a module, other than its primary one, that the agent holds no workflow from yet. */
    missingTemplatesOf(
        workspaceId: string,
        agentId: string,
        moduleKey: string,
    ): Promise<ReadonlyArray<WorkflowTemplate>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const held = new Set(
                (await this.records.workflowsOf(tx, agentId, WORKFLOW_LIMIT)).flatMap((workflow) =>
                    workflow.template === null ? [] : [workflow.template.templateId],
                ),
            )
            return INSTALLED.templatesOf(moduleKey).filter((template) => !template.primary && !held.has(template.id))
        })
    }

    /**
     * Copies every workflow of one installation's agent to another's of the same module (the "copy setup from" of a new agent of the
     * role): each with its key, name, status, primary flag, place and template provenance, and its CURRENT snapshot as version 1 of the
     * copy. A key the target already holds is skipped, so a rerun copies nothing twice. Answers how many were copied.
     */
    async copyWorkflows(workspaceId: string, copy: WorkflowCopy, author: WorkflowAuthor): Promise<number> {
        const [source, target] = await this.agentsOf(workspaceId, copy)
        await this.adoptAgentGraph(workspaceId, source)
        const sourcesOf = async (tx: ScopedTx): Promise<ReadonlyArray<WorkflowRecord>> => {
            const taken = await this.store.keysOf(tx, target)
            return (await this.records.workflowsOf(tx, source, WORKFLOW_LIMIT)).filter(
                (workflow) => !taken.has(workflow.key),
            )
        }
        const settled = await this.copyRightsOf(workspaceId, target, sourcesOf)
        const work: ScopedWork<ReadonlyArray<CopiedWorkflow>> = async (tx) => {
            const copies: Array<CopiedWorkflow> = []
            await eachInOrder(await sourcesOf(tx), async (workflow) => {
                const made = await this.copyOne(tx, workflow, target, author, settled.get(workflow.id))
                if (made !== null) copies.push(made)
            })
            return copies
        }
        const order = [...settled.keys()]
        const copies =
            this.rows === undefined
                ? await this.engine.scoped(workspaceId, work)
                : await this.rows.runMany(workspaceId, [...settled.values()], work, (made) =>
                      order.map((sourceId) => made.find((entry) => entry.sourceId === sourceId)),
                  )
        return copies.length
    }

    /** What the gate settles for each workflow a copy would make, by the id of its source: the target agent's ticks decide what comes with it. */
    private async copyRightsOf(
        workspaceId: string,
        agentId: string,
        sourcesOf: (tx: ScopedTx) => Promise<ReadonlyArray<WorkflowRecord>>,
    ): Promise<ReadonlyMap<string, RightsSettlement>> {
        const settled = new Map<string, RightsSettlement>()
        const { rights } = this
        if (rights === undefined) return settled
        const graphs = await this.engine.scoped(workspaceId, async (tx) => {
            const read: Array<{ readonly sourceId: string; readonly graph: GraphSpec }> = []
            await eachInOrder(await sourcesOf(tx), async (workflow) => {
                const running = await this.store.runningOf(tx, workflow)
                if (running !== null) read.push({ sourceId: workflow.id, graph: snapshotOf(running) })
            })
            return read
        })
        await eachInOrder(graphs, async ({ sourceId, graph }) => {
            const question = { workspaceId, agentId, workflowId: null, before: null, after: graph, byTemplate: true }
            settled.set(sourceId, await rights.decide(question))
        })
        return settled
    }

    private async copyOne(
        tx: ScopedTx,
        source: WorkflowRecord,
        agentId: string,
        author: WorkflowAuthor,
        rights: RightsSettlement | undefined,
    ): Promise<CopiedWorkflow | null> {
        const running = await this.store.runningOf(tx, source)
        if (running === null) return null
        const graph = snapshotOf(running)
        const held = source.primary ? await this.heldVersionOf(source.workspaceId, agentId, graph) : null
        const workflow = await this.store.insertWorkflow(tx, {
            agentId,
            key: source.key,
            name: source.name,
            status: source.status,
            primary: source.primary,
            template: source.template,
            createdBy: author.memberId,
        })
        const written = await this.store.writeVersion(tx, {
            workflow: { ...workflow, position: source.position },
            graph,
            kind: "copy",
            author,
            note: "",
            template: source.template,
            fromNumber: running.number,
            graphVersionId: held,
            expected: 0,
            rights: settledOr(rights, snapshotHashOf(graph), agentId, workflow.id),
        })
        return { sourceId: source.id, workflowId: workflow.id, versionId: written.version.id }
    }

    /**
     * The agent graph version of the target that already holds this graph (the copy the graph store published under its own checks),
     * so a primary copy adopts it instead of publishing the same graph again; null when the target runs another graph.
     */
    private async heldVersionOf(workspaceId: string, agentId: string, graph: GraphSpec): Promise<OptionalWorkflowId> {
        const active = await this.activeOf(workspaceId, agentId)
        return active !== null && sameJson(active.flow, graph) ? active.versionId : null
    }

    private async agentsOf(workspaceId: string, copy: WorkflowCopy): Promise<readonly [string, string]> {
        if (this.installations === undefined) throw workflowNotFound()
        const [from, to] = await Promise.all([
            this.installations.find(workspaceId, copy.fromInstallationId),
            this.installations.find(workspaceId, copy.toInstallationId),
        ])
        if (!from?.agentId || !to?.agentId || from.moduleKey !== to.moduleKey) throw workflowNotFound()
        return [from.agentId, to.agentId]
    }

    private async activeOf(workspaceId: string, agentId: string): Promise<ActiveGraph | null> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        const flow = state?.active?.flow
        const versionId = state?.activeVersionId ?? null
        return flow === undefined || versionId === null ? null : { versionId, flow }
    }

    private async standingOf(tx: ScopedTx, agentId: string, versionId: string): Promise<PrimaryStanding> {
        const primary = (await this.records.workflowsOf(tx, agentId, WORKFLOW_LIMIT)).find((entry) => entry.primary)
        if (primary === undefined) return { primary: null, synced: false }
        return { primary, synced: (await this.records.versionOfGraphVersion(tx, agentId, versionId)) !== null }
    }

    private async catchUp(
        workspaceId: string,
        primary: WorkflowRecord,
        versions: ReadonlyArray<GraphVersionView>,
        active: ActiveGraph,
    ): Promise<string> {
        const view = versions.find((version) => version.id === active.versionId)
        if (view === undefined) return primary.id
        const rights = await this.rights?.decideWorkflow({
            workspaceId,
            workflowId: primary.id,
            afterOf: () => Promise.resolve(active.flow),
            byTemplate: true,
        })
        const work: ScopedWork<string> = async (tx) => {
            const current = await this.store.workflowRequired(tx, primary.id)
            const written = await this.store.writeVersion(tx, {
                ...this.adoptedWrite(current, { view, flow: active.flow }, false, current.latestNumber),
                rights: settledOr(rights, snapshotHashOf(active.flow), current.agentId, current.id),
            })
            return written.version.id
        }
        if (this.rows === undefined || rights === undefined) await this.engine.scoped(workspaceId, work)
        else await this.rows.run(workspaceId, rights, work, (versionId) => ({ workflowId: primary.id, versionId }))
        return primary.id
    }

    private async adoptAll(
        workspaceId: string,
        agentId: string,
        adopted: ReadonlyArray<AdoptedVersion>,
    ): Promise<string> {
        const newest = adopted.at(-1)?.flow ?? adopted[0]?.flow
        const template = INSTALLED.templatesOf(newest?.moduleKey ?? "").find((entry) => entry.primary) ?? null
        // Only the newest adopted version runs: the gate decides it, and the versions before it are history that asks nothing.
        const rights =
            newest === undefined
                ? undefined
                : await this.rights?.decide({
                      workspaceId,
                      agentId,
                      workflowId: null,
                      before: null,
                      after: newest,
                      byTemplate: true,
                  })
        const work: ScopedWork<CopiedWorkflow> = async (tx) => {
            const workflow = await this.store.insertWorkflow(tx, {
                agentId,
                key: template === null ? MAIN_KEY : (template.id.split(".").at(-1) ?? MAIN_KEY),
                name: template?.name.vi ?? MAIN_KEY,
                status: "active",
                primary: true,
                template: newest === undefined ? null : closestLinkOf(template, newest),
                createdBy: null,
            })
            let current = workflow
            let versionId = ""
            await eachInOrder(adopted, async (entry, at) => {
                const hash = snapshotHashOf(entry.flow)
                const last = at === adopted.length - 1
                const written = await this.store.writeVersion(tx, {
                    ...this.adoptedWrite(current, entry, at === 0, at),
                    rights: last ? settledOr(rights, hash, agentId, workflow.id) : noRights(hash, agentId, workflow.id),
                })
                current = written.workflow
                versionId = written.version.id
            })
            return { sourceId: workflow.id, workflowId: workflow.id, versionId }
        }
        const made =
            this.rows === undefined || rights === undefined
                ? await this.engine.scoped(workspaceId, work)
                : await this.rows.run(workspaceId, rights, work, (written) => written)
        return made.workflowId
    }

    private adoptedWrite(
        workflow: WorkflowRecord,
        entry: AdoptedVersion,
        first: boolean,
        expected: number,
    ): Omit<VersionWrite, "rights"> {
        const template = INSTALLED.templatesOf(entry.flow.moduleKey).find(
            (candidate) => candidate.id === workflow.template?.templateId,
        )
        return {
            workflow,
            graph: entry.flow,
            kind: adoptedKindOf(entry.view.changeKind, first),
            author: adoptedAuthorOf(entry.view),
            note: entry.view.note,
            template: template === undefined ? workflow.template : closestLinkOf(template, entry.flow),
            fromNumber: null,
            graphVersionId: entry.view.id,
            expected,
            publishedAt: entry.view.publishedAt,
        }
    }

    /** The agent graph versions that froze a flow, oldest first, each kept once even when versions in a row hold the same flow. */
    private async flowsOf(
        workspaceId: string,
        agentId: string,
        versions: ReadonlyArray<GraphVersionView>,
    ): Promise<ReadonlyArray<AdoptedVersion>> {
        const found: Array<AdoptedVersion> = []
        await eachInOrder(versions, async (view) => {
            const flow = await this.flowOfVersion(workspaceId, agentId, view.id)
            const last = found.at(-1)
            if (flow === null || (last !== undefined && sameJson(last.flow, flow))) return
            found.push({ view, flow })
        })
        return found
    }

    private async flowOfVersion(workspaceId: string, agentId: string, versionId: string): Promise<GraphSpec | null> {
        try {
            return (await this.graphs.documentOf(workspaceId, agentId, versionId)).flow ?? null
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.WorkflowAdoptSkipped, cause, { agentId, versionId })
            return null
        }
    }
}
