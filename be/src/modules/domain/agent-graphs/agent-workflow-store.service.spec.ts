import { Test } from "@nestjs/testing"
import { shopAccountingGraph, storeDoubles, workflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import type { StoreDoubles, WorkflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { workflowRecordOf, workflowVersionRecordOf } from "./agent-workflows.mapper"
import type { WorkflowRecord, WorkflowVersionRecord } from "./agent-workflows.contracts"
import { SCOPE } from "@tests/fixtures/builders/agent-graph-records.builder"
import { templateGraph } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentGraphsErrorCode } from "./errors/agent-graphs.error"

/** The workflow services on the doubles, and what the memory engine holds. */
interface World extends WorkflowDoubles {
    readonly workflows: AgentWorkflowsService
    readonly adoption: AgentWorkflowAdoptionService
    readonly runs: AgentWorkflowRunsService
    readonly store: AgentWorkflowStoreService
}

const buildWorld = async (): Promise<World> => {
    const doubles = workflowDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowRunsService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
    ])
    const moduleRef = await Test.createTestingModule({ providers: [...doubles.providers] }).compile()
    return {
        ...doubles,
        workflows: moduleRef.get(AgentWorkflowsService),
        adoption: moduleRef.get(AgentWorkflowAdoptionService),
        runs: moduleRef.get(AgentWorkflowRunsService),
        store: moduleRef.get(AgentWorkflowStoreService),
    }
}

const workflowsOf = (world: World): ReadonlyArray<WorkflowRecord> =>
    world.memory.rows("agent.workflow").map(workflowRecordOf)

const versionsOf = (world: World): ReadonlyArray<WorkflowVersionRecord> =>
    world.memory.rows("agent.workflow-version").map(workflowVersionRecordOf)

const OWNER = { kind: "owner" as const, memberId: "member-1" }

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof Error && "code" in cause ? cause.code : cause
    }
}

describe("AgentWorkflowStoreService", () => {
    it("refuses a version whose number someone else took first, and an unknown workflow", async () => {
        const world = await buildWorld()
        const pick = { templateId: "accounting.reports", version: null }
        const made = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        const held = workflowsOf(world).filter((workflow) => workflow.id === made.id)
        const stale = held.map((workflow) => ({ ...workflow, latestNumber: 0 }))
        const graph = templateGraph("accounting.reports")
        const writes = stale.map((workflow) => ({
            workflow,
            graph,
            kind: "edit" as const,
            author: OWNER,
            note: "",
            template: null,
            fromNumber: null,
            graphVersionId: null,
            expected: null,
        }))

        expect(writes).toHaveLength(1)
        await expect(codeOf(Promise.all(writes.map((write) => world.store.writeVersion(SCOPE, write))))).resolves.toBe(
            AgentGraphsErrorCode.WorkflowConflict,
        )
        await expect(codeOf(world.store.workflowRequired(SCOPE, "wf-none"))).resolves.toBe(
            AgentGraphsErrorCode.WorkflowNotFound,
        )
    })

    it("keeps a non-primary workflow's versions off the agent graph", async () => {
        const world = await buildWorld()
        const pick = { templateId: "accounting.reports", version: null }

        await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")

        expect(world.graphs.publish).not.toHaveBeenCalled()
        expect(versionsOf(world)[0]?.graphVersionId).toBeNull()
    })

    it("cuts no grant and judges nothing in an app that installed no nodes", async () => {
        const world = await buildWorld()
        const graph = templateGraph("accounting.reconcile")

        expect(world.store.trimmedGrantOf(graph)).toEqual(graph.grant)
        expect(() => world.store.requireSound(graph)).not.toThrow()
    })
})

/** The workflow services over the real agent graph store, both on one transactional memory engine. */
interface StoreWorld {
    readonly memory: StoreDoubles["memory"]
    readonly workflows: AgentWorkflowsService
    readonly graphs: AgentGraphsService
}

const buildStoreWorld = async (): Promise<StoreWorld> => {
    const doubles = storeDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
        AgentGraphsService,
        AgentGraphRecordsService,
    ])
    const moduleRef = await Test.createTestingModule({ providers: [...doubles.providers] }).compile()
    const graphs = moduleRef.get(AgentGraphsService)
    await graphs.ensure("ws-1", "agent-1", "inst-1", { nodes: [], rights: [], flow: shopAccountingGraph() })
    const workflows = moduleRef.get(AgentWorkflowsService)
    // The reconcile graph ends in a hand-off to the after-sale workflow, which must be there for a publish of it to be sound.
    await workflows.createFromTemplate(
        "ws-1",
        "agent-1",
        { templateId: "sales.after-sale", version: null },
        OWNER,
        "vi",
    )
    return { memory: doubles.memory, workflows, graphs }
}

/** The primary workflow's id, the newest number of its history, and the agent graph version that decides. */
const standingOf = async (world: StoreWorld): Promise<readonly [number, string | null, number]> => {
    const primary = (await world.workflows.list("ws-1", "agent-1", "vi")).find((workflow) => workflow.primary)
    return [
        primary?.latestNumber ?? -1,
        await world.graphs.activeVersionIdOf("ws-1", "agent-1"),
        await world.graphs.latestVersionOf("ws-1", "agent-1"),
    ]
}

describe("AgentWorkflowStoreService: the primary workflow and the agent graph publish as one", () => {
    it("rolls the agent graph version back when the workflow version fails after it", async () => {
        const world = await buildStoreWorld()
        const primary = (await world.workflows.list("ws-1", "agent-1", "vi")).find((workflow) => workflow.primary)
        const before = await standingOf(world)
        world.memory.failWhen((mutation) => mutation.op === "insert" && mutation.entity === "agent.workflow-version")

        await expect(
            world.workflows.publish("ws-1", primary?.id ?? "", templateGraph("accounting.reconcile"), OWNER, 1, ""),
        ).rejects.toThrow("memory engine: insert failed")

        expect(await standingOf(world)).toEqual(before)
        expect(before).toEqual([1, "graph-version-2", 1])
    })

    it("moves both together when the write goes through: the workflow version names the agent graph version that decides", async () => {
        const world = await buildStoreWorld()
        const primary = (await world.workflows.list("ws-1", "agent-1", "vi")).find((workflow) => workflow.primary)

        await world.workflows.publish("ws-1", primary?.id ?? "", templateGraph("accounting.reconcile"), OWNER, 1, "")
        const [latest, activeId, graphLatest] = await standingOf(world)
        const newest = world.memory
            .rows("agent.workflow-version")
            .map(workflowVersionRecordOf)
            .find((version) => version.number === 2)

        expect([latest, graphLatest]).toEqual([2, 2])
        expect(newest?.graphVersionId).toBe(activeId)
    })
})
