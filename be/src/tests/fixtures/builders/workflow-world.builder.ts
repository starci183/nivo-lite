import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion, type WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import { EntityEngineService, type ScopedTx, type ScopedWork } from "@modules/domain/entity-engine"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { EntityManager } from "typeorm"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { AgentWorkflowAdoptionService } from "../../../modules/domain/agent-graphs/agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "../../../modules/domain/agent-graphs/agent-workflow-records.service"
import { AgentWorkflowRunsService } from "../../../modules/domain/agent-graphs/agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "../../../modules/domain/agent-graphs/agent-workflow-store.service"
import type {
    RunWorkflowPin,
    RunWorkflowPinWrite,
    WorkflowRecord,
    WorkflowVersionRecord,
} from "../../../modules/domain/agent-graphs/agent-workflows.contracts"

/** The modules whose agents the demo shop runs. */
export type ModuleName = "chatbot" | "sales"

const SEEDED_AT = new Date("2026-11-09T02:00:00.000Z")

/** One workflow the seed makes for an agent from a template: its key, its template and the graph of the newest version. */
export interface SeededWorkflow {
    /** The workflow key within the agent (`consult`), which namespaces its lead memory as `<module>.<key>`. */
    readonly key: string
    /** The template it was made from. */
    readonly templateId: string
    /** Whether it is the agent's main workflow. */
    readonly primary: boolean
    /** The version id the run's steps read their graph by. */
    readonly versionId: string
    /** The newest version number of the template. */
    readonly number: number
    /** The graph of that version. */
    readonly graph: GraphSpec
}

/**
 * The workflows the seed makes ACTIVE for an agent of a module: the primary template and every `seedActive` one, each at its newest
 * version, in catalogue order. A template that is neither stays a draft and never takes a wake.
 */
export const seededWorkflowsOf = (agentId: string, moduleKey: string): ReadonlyArray<SeededWorkflow> =>
    INSTALLED.templates().filter(
        (template: WorkflowTemplate) =>
            template.moduleKey === moduleKey && (template.primary || template.seedActive === true),
    ).map((template) => {
        const version = latestTemplateVersion(template)
        const key = template.id.slice(moduleKey.length + 1)
        return {
            key,
            templateId: template.id,
            primary: template.primary,
            versionId: `${agentId}:${key}@${version.version}`,
            number: version.version,
            graph: version.graph,
        }
    })

/** The workflows of a workspace's agents, and the routing the run engine does over them. */
export interface WorkflowWorld {
    /** The real routing service, over the seeded workflows. */
    readonly service: AgentWorkflowRunsService
    /** The graph each version id names, across every agent. */
    readonly graphs: ReadonlyMap<string, GraphSpec>
    /** The workflow each run was pinned to, by run id. */
    readonly pins: Map<string, RunWorkflowPin>
    /** The engine and the records behind the routing, for the guards that read the same pins. */
    readonly engine: EntityEngineService
    readonly records: AgentWorkflowRecordsService
    /** The workflows seeded for one agent. */
    readonly workflowsOf: (agentId: string) => ReadonlyArray<SeededWorkflow>
}

const workflowRecordOf = (agentId: string, workflow: SeededWorkflow, position: number): WorkflowRecord => ({
    id: `${agentId}:${workflow.key}`,
    workspaceId: "ws-1",
    fence: "1",
    agentId,
    key: workflow.key,
    name: workflow.key,
    status: "active",
    primary: workflow.primary,
    position,
    activeVersionId: workflow.versionId,
    latestNumber: workflow.number,
    template: { templateId: workflow.templateId, templateVersion: workflow.number },
    createdBy: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
})

/** A graph as the stored snapshot keeps it: a plain JSON copy. */
const documentOf = (graph: GraphSpec): Readonly<Record<string, JsonValue>> => {
    const copy: unknown = structuredClone(graph)
    return isRecord(copy) ? copy : {}
}

const isRecord = (value: unknown): value is Readonly<Record<string, JsonValue>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The text of a member of a write, or an empty text. */

const versionRecordOf = (agentId: string, workflow: SeededWorkflow): WorkflowVersionRecord => ({
    id: workflow.versionId,
    workspaceId: "ws-1",
    workflowId: `${agentId}:${workflow.key}`,
    agentId,
    number: workflow.number,
    document: documentOf(workflow.graph),
    documentHash: workflow.versionId,
    changeKind: "template",
    authorKind: "system",
    authorId: null,
    note: "",
    template: { templateId: workflow.templateId, templateVersion: workflow.number },
    fromNumber: null,
    graphVersionId: null,
    publishedAt: SEEDED_AT,
})

/**
 * The workflows of a shop's agents, seeded from the templates (the primary and every `seedActive` one, active), behind the REAL
 * `AgentWorkflowRunsService`: the routing of a wake picks the workflow by the hand-off's pin, else by a trigger's source kind, channel
 * and conditions, exactly as the engine does. `agents` maps each agent id to its module key.
 */
export const workflowWorldOf = (agents: Readonly<Record<string, string>>): WorkflowWorld => {
    const seeded = new Map(Object.entries(agents).map(([agentId, module]) => [agentId, seededWorkflowsOf(agentId, module)]))
    const workflowsOf = (agentId: string): ReadonlyArray<SeededWorkflow> => seeded.get(agentId) ?? []
    const all = [...seeded.entries()].flatMap(([agentId, workflows]) => workflows.map((workflow) => ({ agentId, workflow })))
    const graphs = new Map(all.map(({ workflow }) => [workflow.versionId, workflow.graph]))
    const pins = new Map<string, RunWorkflowPin>()
    const tx = mock<ScopedTx>({ workspaceId: "ws-1" })
    const engine = mock<EntityEngineService>({
        scoped: <T>(_workspace: string, work: ScopedWork<T>) => work(tx),
        within: <T>(_manager: EntityManager, _workspace: string, work: ScopedWork<T>) => work(tx),
    })
    const versionOf = (versionId: string): WorkflowVersionRecord | null => {
        const found = all.find(({ workflow }) => workflow.versionId === versionId)
        return found === undefined ? null : versionRecordOf(found.agentId, found.workflow)
    }
    const records = mock<AgentWorkflowRecordsService>({
        workflowsOf: (_tx: ScopedTx, agentId: string) =>
            Promise.resolve(workflowsOf(agentId).map((workflow, at) => workflowRecordOf(agentId, workflow, at))),
        version: (_tx: ScopedTx, versionId: string) => Promise.resolve(versionOf(versionId)),
        versionsOf: (_tx: ScopedTx, workflowId: string) =>
            Promise.resolve(
                all
                    .filter(({ agentId, workflow }) => `${agentId}:${workflow.key}` === workflowId)
                    .map(({ agentId, workflow }) => versionRecordOf(agentId, workflow)),
            ),
        workflow: (_tx: ScopedTx, workflowId: string) => {
            const found = all.find(({ agentId, workflow }) => `${agentId}:${workflow.key}` === workflowId)
            return Promise.resolve(
                found === undefined ? null : workflowRecordOf(found.agentId, found.workflow, 0),
            )
        },
        pinRun: (_tx: ScopedTx, values: RunWorkflowPinWrite) => {
            if (!pins.has(values.runId))
                pins.set(values.runId, {
                    runId: values.runId,
                    workflowId: values.workflowId,
                    workflowVersionId: values.workflowVersionId,
                    workflowVersion: values.workflowVersion,
                })
            return Promise.resolve()
        },
        pinsOf: (_tx: ScopedTx, runIds: ReadonlyArray<string>) =>
            Promise.resolve(runIds.flatMap((runId) => pins.get(runId) ?? [])),
        runsOfWorkflow: (_tx: ScopedTx, _agentId: string, workflowId: string) =>
            Promise.resolve([...pins.values()].filter((pin) => pin.workflowId === workflowId).toReversed()),
    })
    const store = mock<AgentWorkflowStoreService>({
        runningOf: (_tx: ScopedTx, workflow: WorkflowRecord) =>
            Promise.resolve(workflow.activeVersionId === null ? null : versionOf(workflow.activeVersionId)),
    })
    const adoption = mock<AgentWorkflowAdoptionService>({ adoptAgentGraph: () => Promise.resolve(null) })
    return {
        service: new AgentWorkflowRunsService(engine, records, store, adoption),
        graphs,
        pins,
        engine,
        records,
        workflowsOf,
    }
}
