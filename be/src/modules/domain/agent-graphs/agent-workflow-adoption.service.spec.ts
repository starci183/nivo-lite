import { Test } from "@nestjs/testing"
import { workflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import type { WorkflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { workflowRecordOf, workflowVersionRecordOf } from "./agent-workflows.mapper"
import type { WorkflowRecord, WorkflowVersionRecord } from "./agent-workflows.contracts"
import {
    graphStateOf,
    graphVersionOf,
    ownerEdited,
    templateGraph,
    templateNewest,
} from "@tests/fixtures/builders/agent-workflows.builder"
import { workflowNotFound } from "./policies/workflow-view.policy"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"

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

describe("AgentWorkflowAdoptionService: the primary workflow", () => {
    it("makes the running agent graph the primary workflow, linked to the template version it is closest to", async () => {
        const world = await buildWorld()

        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        const [primary] = await world.workflows.list("ws-1", "agent-1", "vi")

        expect(primary).toMatchObject({
            primary: true,
            status: "active",
            activeNumber: 1,
            template: { templateId: "accounting.reconcile", templateVersion: templateNewest("accounting.reconcile") },
            templateLatest: templateNewest("accounting.reconcile"),
            templateChangedSteps: 1,
        })
        expect(versionsOf(world)[0]).toMatchObject({ changeKind: "adopt", graphVersionId: "graph-v1" })
    })

    it("adopts once, then appends a version when the agent graph was published elsewhere", async () => {
        const world = await buildWorld()
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")

        expect(versionsOf(world)).toHaveLength(1)

        world.graphs.stateOfAgent.mockResolvedValue(graphStateOf("graph-v9", templateGraph("accounting.reconcile")))
        world.graphs.versionsOf.mockResolvedValue([graphVersionOf("graph-v9", 9), graphVersionOf("graph-v1", 1)])
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")

        expect(versionsOf(world).map((version) => version.graphVersionId)).toEqual(["graph-v1", "graph-v9"])
        expect(world.graphs.publish).not.toHaveBeenCalled()
    })

    it("adopts nothing for an agent that runs no flow, and leaves out a version it cannot read", async () => {
        const world = await buildWorld()
        world.graphs.stateOfAgent.mockResolvedValueOnce(null)

        await expect(world.adoption.adoptAgentGraph("ws-1", "agent-1")).resolves.toBeNull()

        world.graphs.versionsOf.mockResolvedValue([graphVersionOf("graph-v1", 1), graphVersionOf("graph-v0", 0)])
        world.graphs.documentOf.mockImplementation((_workspaceId, _agentId, versionId) =>
            versionId === "graph-v0"
                ? Promise.reject(workflowNotFound())
                : Promise.resolve({ nodes: [], rights: [], flow: templateGraph("accounting.reconcile") }),
        )
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")

        expect(versionsOf(world)).toHaveLength(1)
        expect(world.logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.WorkflowAdoptSkipped, expect.anything(), {
            agentId: "agent-1",
            versionId: "graph-v0",
        })
    })
})

describe("AgentWorkflowAdoptionService: copying workflows", () => {
    it("copies every workflow to another installation's agent with its current snapshot as version 1, once", async () => {
        const world = await buildWorld()
        const pick = { templateId: "accounting.reports", version: null }
        const made = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        await world.workflows.publish("ws-1", made.id, ownerEdited(templateGraph("accounting.reports")), OWNER, 1, "")
        const copy = { fromInstallationId: "inst-1", toInstallationId: "inst-2" }

        await expect(world.adoption.copyWorkflows("ws-1", copy, OWNER)).resolves.toBe(2)
        await expect(world.adoption.copyWorkflows("ws-1", copy, OWNER)).resolves.toBe(0)

        const targets = workflowsOf(world)
            .filter((workflow) => workflow.agentId === "agent-2")
            .toSorted((left, right) => left.key.localeCompare(right.key))
        expect(targets.map((workflow) => [workflow.key, workflow.primary, workflow.latestNumber])).toEqual([
            ["reconcile", true, 1],
            ["reports", false, 1],
        ])
        expect(targets[1]?.template).toEqual({
            templateId: "accounting.reports",
            templateVersion: templateNewest("accounting.reports"),
        })
        const copies = versionsOf(world).filter((version) => version.agentId === "agent-2")
        expect(copies.map((version) => [version.changeKind, version.fromNumber])).toEqual([
            ["copy", 2],
            ["copy", 1],
        ])
    })

    it("lets the primary copy adopt the graph the target already runs instead of publishing it again", async () => {
        const world = await buildWorld()
        const copy = { fromInstallationId: "inst-1", toInstallationId: "inst-2" }

        await world.adoption.copyWorkflows("ws-1", copy, OWNER)

        const copied = versionsOf(world).filter((version) => version.agentId === "agent-2")
        expect(copied.map((version) => version.graphVersionId)).toEqual(["graph-v1"])
        expect(world.graphs.publish).not.toHaveBeenCalled()
    })

    it("copies nothing onto the agent it copies from: every key is already held", async () => {
        const world = await buildWorld()

        await expect(
            world.adoption.copyWorkflows("ws-1", { fromInstallationId: "inst-1", toInstallationId: "inst-1" }, OWNER),
        ).resolves.toBe(0)
    })
})
