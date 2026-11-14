import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { jsonOf } from "./agent-graphs.mapper"
import type { GraphDocument } from "./agent-graphs.contracts"
import type {
    OptionalWorkflowVersionRecord,
    VersionWrite,
    WorkflowCreate,
    WorkflowRecord,
    WorkflowVersionRecord,
    WrittenVersion,
} from "./agent-workflows.contracts"
import { CONTRACT_VIEWS } from "./policies/contract-views.policy"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { requireSoundFlow } from "./policies/flow.policy"
import { brokenCallersOf, callContractProblems, type CallableWorkflow } from "./policies/workflow-calls.policy"
import { minimumGrantOf } from "./policies/workflow-merge.policy"
import { nextVersionNumber } from "./policies/workflow-version.policy"
import {
    graphKindOf,
    snapshotHashOf,
    snapshotOf,
    workflowConflict,
    workflowNotFound,
} from "./policies/workflow-view.policy"

/** The most workflows one agent holds. */
export const WORKFLOW_LIMIT = 50

/** The most versions one history answers. */
export const VERSION_LIMIT = 100

/** The most workflows of a workspace the hand-off check reads. */
const WORKSPACE_WORKFLOW_LIMIT = 500

/** The document of an agent graph before it has any version. */
const EMPTY: GraphDocument = { nodes: [] }

@Injectable()
/**
 * The write core of the workflows: making a workflow, appending a version (under the fence of the newest number and the record version,
 * so history only grows and two writers never take one number), reading what runs, and judging a graph against the installed nodes.
 * A primary workflow's version publishes its snapshot as the agent graph's next version first, so the rest of the engine reads the same
 * graph, in the SAME `ScopedTx`: the workflow version and the agent graph version commit together or not at all. Every method runs in
 * the `ScopedTx` it is given. EVERY version write passes here or through `AgentGraphsService.publish`, and each carries the settlement
 * of the rights gate for exactly the graph it writes (`VersionWrite.rights`): a version the gate did not decide is not written.
 */
export class AgentWorkflowStoreService {
    constructor(
        private readonly records: AgentWorkflowRecordsService,
        private readonly graphs: AgentGraphsService,
        @Optional() private readonly nodes?: GraphNodeRegistryService,
    ) {}

    /** A workflow; refused when there is none. */
    async workflowRequired(tx: ScopedTx, workflowId: string): Promise<WorkflowRecord> {
        const workflow = await this.records.workflow(tx, workflowId)
        if (workflow === null) throw workflowNotFound()
        return workflow
    }

    /** The version that runs, or the newest when none runs yet; null for a workflow with no version. */
    async runningOf(tx: ScopedTx, workflow: WorkflowRecord): Promise<OptionalWorkflowVersionRecord> {
        if (workflow.activeVersionId !== null) return this.records.version(tx, workflow.activeVersionId)
        return (await this.records.versionsOf(tx, workflow.id, 1)).at(0) ?? null
    }

    /** The version that runs, refused when the workflow has none. */
    async runningRequired(tx: ScopedTx, workflow: WorkflowRecord): Promise<WorkflowVersionRecord> {
        const running = await this.runningOf(tx, workflow)
        if (running === null) throw workflowNotFound()
        return running
    }

    /** The keys the agent's workflows hold. */
    async keysOf(tx: ScopedTx, agentId: string): Promise<ReadonlySet<string>> {
        return new Set((await this.records.workflowsOf(tx, agentId, WORKFLOW_LIMIT)).map((workflow) => workflow.key))
    }

    /** Makes a workflow at the end of the agent's list, with no version yet; refused when its key is taken. */
    async insertWorkflow(tx: ScopedTx, create: WorkflowCreate): Promise<WorkflowRecord> {
        const position = (await this.records.workflowsOf(tx, create.agentId, WORKFLOW_LIMIT)).length
        const workflow = await this.records.insertWorkflow(tx, {
            agentId: create.agentId,
            key: create.key,
            name: create.name,
            status: create.status,
            primary: create.primary,
            position,
            latestNumber: 0,
            activeVersionId: null,
            templateId: create.template?.templateId ?? null,
            templateVersion: create.template?.templateVersion ?? null,
            createdBy: create.createdBy,
        })
        if (workflow === null) throw workflowConflict()
        return workflow
    }

    /** Appends a version, makes it the one that runs and moves the workflow's provenance with it. */
    async writeVersion(tx: ScopedTx, write: VersionWrite): Promise<WrittenVersion> {
        const number = nextVersionNumber(write.workflow.latestNumber, write.expected)
        if (number === null) throw workflowConflict()
        // The gate decided one graph; another graph (a version that changed between the decision and the write) is not it.
        if (write.rights.graphHash !== snapshotHashOf(write.graph)) throw workflowConflict()
        const graphVersionId = write.graphVersionId ?? (await this.mirrorOf(tx, write))
        const version = await this.records.insertVersion(tx, {
            workflowId: write.workflow.id,
            agentId: write.workflow.agentId,
            number,
            document: jsonOf(write.graph),
            documentHash: snapshotHashOf(write.graph),
            changeKind: write.kind,
            authorKind: write.author.kind,
            authorId: write.author.memberId,
            note: write.note,
            templateId: write.template?.templateId ?? null,
            templateVersion: write.template?.templateVersion ?? null,
            fromNumber: write.fromNumber,
            graphVersionId,
            ...(write.publishedAt === undefined ? {} : { publishedAt: write.publishedAt }),
        })
        if (version === null) throw workflowConflict()
        const workflow = await this.records.patchWorkflow(tx, write.workflow, {
            activeVersionId: version.id,
            latestNumber: number,
            position: write.workflow.position,
            templateId: write.template?.templateId ?? null,
            templateVersion: write.template?.templateVersion ?? null,
        })
        if (workflow === null) throw workflowConflict()
        return { workflow, version }
    }

    /**
     * Refuses a version whose end hand-offs do not cover the workflows they call (a missing or mistyped input, an unknown target or
     * version, a closed entry), or which would break a workflow that calls this one as `latest`: the two-way check that lets a hand-off
     * follow the target's newest version safely. Every problem in `problems`, the first worded in Vietnamese in `first`. `together`: the
     * graphs, by workflow id, of a SET of versions written as one change (a re-seed): every workflow of the set is judged as running its
     * graph of the set, so a hand-off whose two ends change together is judged against the other end's new version, whichever is
     * written first.
     */
    async requireCallsSound(
        tx: ScopedTx,
        workflow: WorkflowRecord,
        graph: GraphSpec,
        together: ReadonlyMap<string, GraphSpec> = new Map(),
    ): Promise<void> {
        const all = await this.callablesOf(tx, together)
        const saver = { agentId: workflow.agentId, moduleKey: graph.moduleKey, key: workflow.key }
        const own = callContractProblems(saver, graph, all.map((entry) => entry.callable))
        const broken = brokenCallersOf(
            saver,
            graph,
            all.filter((entry) => entry.callable.agentId !== workflow.agentId || entry.callable.key !== workflow.key).map((entry) => ({
                agentId: entry.callable.agentId,
                key: entry.callable.key,
                name: entry.name,
                running: entry.callable.running,
            })),
        )
        const problems = [...own, ...broken.flatMap((caller) => caller.problems)]
        const [first] = problems
        if (first === undefined) return
        const named = broken.at(0)
        throw new AgentGraphsError({
            code: AgentGraphsErrorCode.ContractRefused,
            params: {
                count: String(problems.length),
                first:
                    own.length > 0 || named === undefined
                        ? CONTRACT_VIEWS.contractProblemText(first, "vi")
                        : `Quy trình "${named.name}" đang gọi quy trình này sẽ hỏng: ${CONTRACT_VIEWS.contractProblemText(first, "vi")}`,
                problems: JSON.stringify(problems),
            },
        })
    }

    /** Every workflow of the workspace with the graph it runs (its graph in `together` when the set holds it), its versions by number, and its name. */
    private async callablesOf(
        tx: ScopedTx,
        together: ReadonlyMap<string, GraphSpec>,
    ): Promise<ReadonlyArray<{ readonly callable: CallableWorkflow; readonly name: string }>> {
        const found: Array<{ readonly callable: CallableWorkflow; readonly name: string }> = []
        for (const workflow of await this.records.workflowsOfWorkspace(tx, WORKSPACE_WORKFLOW_LIMIT)) {
            const versions = await this.records.versionsOf(tx, workflow.id, VERSION_LIMIT)
            const running = await this.runningOf(tx, workflow)
            if (running === null) continue
            const graph = together.get(workflow.id) ?? snapshotOf(running)
            found.push({
                name: workflow.name,
                callable: {
                    agentId: workflow.agentId,
                    moduleKey: graph.moduleKey,
                    key: workflow.key,
                    running: graph,
                    versions: new Map(versions.map((version) => [version.number, snapshotOf(version)])),
                },
            })
        }
        return found
    }

    /** Refuses a graph the installed nodes do not take; an app that installed no nodes judges nothing. */
    requireSound(graph: GraphSpec): void {
        if (this.nodes !== undefined) requireSoundFlow(graph, this.nodes.installed())
    }

    /** The grant of a graph cut to what its installed steps need. */
    trimmedGrantOf(graph: GraphSpec): GraphSpec["grant"] {
        return this.nodes === undefined ? graph.grant : minimumGrantOf(graph, this.nodes.installed())
    }

    /**
     * For a primary workflow, publishes the snapshot as the agent graph's next version, keeping the rest of its document, in the
     * transaction of the workflow version: a version write that fails after it rolls the agent graph version back with it.
     */
    private async mirrorOf(tx: ScopedTx, write: VersionWrite): Promise<string | null> {
        if (!write.workflow.primary) return null
        const { workspaceId, agentId } = write.workflow
        const state = await this.graphs.stateOfAgentIn(tx, agentId)
        if (state === null) return null
        const published = await this.graphs.publishIn(tx, {
            workspaceId,
            agentId,
            document: { ...(state.active ?? EMPTY), flow: write.graph },
            kind: graphKindOf(write.kind),
            note: write.note,
            memberId: write.author.memberId,
            contextVersionId: null,
        })
        return published.id
    }
}
