import { readFileSync, readdirSync } from "node:fs"
import { AGENT_WORKFLOWS, AGENT_WORKFLOW_VERSIONS, workflowRecordOfRow, workflowVersionRecordOfRow } from "@tests/fixtures/builders/engine-core-tables.builder"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { AccountAttachmentsService, NodeAccountConsentsService } from "@modules/domain/tool-grants"
import type { NodeAccountPolicyRecord, ProviderAttachmentView } from "@modules/domain/tool-grants"
import { workflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import type { WorkflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentGraphRightsService } from "./agent-graph-rights.service"
import { AgentRightsRecordsService } from "./agent-rights-records.service"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
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
    world.memory.rows(AGENT_WORKFLOWS).map(workflowRecordOfRow)

const versionsOf = (world: World): ReadonlyArray<WorkflowVersionRecord> =>
    world.memory.rows(AGENT_WORKFLOW_VERSIONS).map(workflowVersionRecordOfRow)

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
            template: { templateId: "webbooks.invoice", templateVersion: templateNewest("webbooks.invoice") },
            templateLatest: templateNewest("webbooks.invoice"),
            templateChangedSteps: 1,
        })
        expect(versionsOf(world)[0]).toMatchObject({ changeKind: "adopt", graphVersionId: "graph-v1" })
    })

    it("adopts once, then appends a version when the agent graph was published elsewhere", async () => {
        const world = await buildWorld()
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")

        expect(versionsOf(world)).toHaveLength(1)

        world.graphs.stateOfAgent.mockResolvedValue(graphStateOf("graph-v9", templateGraph("webbooks.invoice")))
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
                : Promise.resolve({ nodes: [], flow: templateGraph("webbooks.invoice") }),
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
        const pick = { templateId: "webbooks.debt-round", version: null }
        const made = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        await world.workflows.publish("ws-1", made.id, ownerEdited(templateGraph("webbooks.debt-round")), OWNER, 1, "")
        const copy = { fromInstallationId: "inst-1", toInstallationId: "inst-2" }

        await expect(world.adoption.copyWorkflows("ws-1", copy, OWNER)).resolves.toBe(2)
        await expect(world.adoption.copyWorkflows("ws-1", copy, OWNER)).resolves.toBe(0)

        const targets = workflowsOf(world)
            .filter((workflow) => workflow.agentId === "agent-2")
            .toSorted((left, right) => left.key.localeCompare(right.key))
        expect(targets.map((workflow) => [workflow.key, workflow.primary, workflow.latestNumber])).toEqual([
            ["debt-round", false, 1],
            ["invoice", true, 1],
        ])
        expect(targets[0]?.template).toEqual({
            templateId: "webbooks.debt-round",
            templateVersion: templateNewest("webbooks.debt-round"),
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

const APPEND = TOOL.ledgerEntryAppend
const VOID = TOOL.ledgerEntryVoid

/** The accounts of the two agents: agent-1 holds a messaging and a books account, agent-2 a messaging account of its own. */
const ATTACHED: Readonly<Record<string, ReadonlyArray<ProviderAttachmentView>>> = {
    "agent-1": [
        { agentId: "agent-1", connectionId: "c-zalo", provider: "zalo_oa" },
        { agentId: "agent-1", connectionId: "c-books", provider: "google" },
    ],
    "agent-2": [
        { agentId: "agent-2", connectionId: "c2-zalo", provider: "zalo_oa" },
    ],
}

/** The adoption roads with the real rights gate, on a grant store kept in memory. */
interface GateWorld extends World {
    readonly grants: Array<NodeAccountPolicyRecord>
    readonly consents: ReturnType<typeof mock<NodeAccountConsentsService>>
}

const buildGateWorld = async (): Promise<GateWorld> => {
    const doubles = workflowDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowRunsService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
        AgentGraphRightsService,
        AgentRightsRecordsService,
    ])
    const grants: Array<NodeAccountPolicyRecord> = []
    const manager = mockEntityManager()
    const consents = mock<NodeAccountConsentsService>()
    consents.listOfWorkflow.mockImplementation((_workspaceId, _agentId, workflowId) =>
        Promise.resolve(grants.filter((row) => row.workflowId === workflowId)),
    )
    consents.transaction.mockImplementation((work) => work(manager))
    consents.record.mockImplementation((_manager, records) => {
        grants.push(...records)
        return Promise.resolve(records.length)
    })
    doubles.memory.engine.within.mockImplementation((_manager, workspaceId, work) =>
        doubles.memory.engine.scoped(workspaceId, work),
    )
    const access = mock<AccountAttachmentsService>()
    access.listOfAgent.mockImplementation((_workspaceId, agentId) => Promise.resolve(ATTACHED[agentId] ?? []))
    const moduleRef = await Test.createTestingModule({
        providers: [
            ...doubles.providers,
            { provide: AccountAttachmentsService, useValue: access },
            { provide: NodeAccountConsentsService, useValue: consents },
        ],
    }).compile()
    return {
        ...doubles,
        workflows: moduleRef.get(AgentWorkflowsService),
        adoption: moduleRef.get(AgentWorkflowAdoptionService),
        runs: moduleRef.get(AgentWorkflowRunsService),
        store: moduleRef.get(AgentWorkflowStoreService),
        grants,
        consents,
    }
}

const rowsOf = (world: GateWorld, agentId: string): ReadonlyArray<ReadonlyArray<unknown>> =>
    world.grants
        .filter((row) => row.agentId === agentId)
        .map((row) => [row.nodeKey, row.connectionId, row.operation, row.mode, row.origin, row.agreedBy])

// nivo-frame `rights`: the publish / install gate is REMOVED, so no road writes a grant row: the node's mode is in the version, the
// attachments say which accounts. The roads keep their versions.
describe("AgentWorkflowAdoptionService: the roads no person walks write no rights row", () => {
    it("adoption: the primary workflow is made with no grant row and no grant transaction", async () => {
        const world = await buildGateWorld()

        const primaryId = await world.adoption.adoptAgentGraph("ws-1", "agent-1")

        expect(workflowsOf(world).map((workflow) => workflow.id)).toEqual([primaryId])
        expect(rowsOf(world, "agent-1")).toEqual([])
        expect(world.consents.transaction).not.toHaveBeenCalled()
    })

    it("catch-up: a version published elsewhere is adopted as the next version, never refused, with no row", async () => {
        const world = await buildGateWorld()
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        const graph = templateGraph("webbooks.invoice")
        const accounts = [
            {
                kind: "books",
                provider: null,
                connectionId: null,
                operations: { [APPEND]: "auto" as const, [VOID]: "ask" as const },
            },
        ]
        const flow = {
            ...graph,
            nodes: graph.nodes.map((node) => (node.key === "ledger" ? { ...node, accounts } : node)),
        }
        world.graphs.stateOfAgent.mockResolvedValue(graphStateOf("graph-v2", flow))
        world.graphs.versionsOf.mockResolvedValue([graphVersionOf("graph-v2", 2), graphVersionOf("graph-v1", 1)])

        await world.adoption.adoptAgentGraph("ws-1", "agent-1")

        expect(versionsOf(world)).toHaveLength(2)
        expect(rowsOf(world, "agent-1")).toEqual([])
    })

    it("copy: each copied workflow is made on the TARGET agent with no row", async () => {
        const world = await buildGateWorld()

        const copied = await world.workflows.copyWorkflows(
            "ws-1",
            { fromInstallationId: "inst-1", toInstallationId: "inst-2" },
            OWNER,
        )

        expect(copied).toBe(1)
        expect(workflowsOf(world).some((workflow) => workflow.agentId === "agent-2")).toBe(true)
        expect(rowsOf(world, "agent-2")).toEqual([])
        expect(world.consents.record).not.toHaveBeenCalled()
    })
})

const DOMAIN = join(__dirname, "..")

/** The production files under a capability folder that hold a piece of code, as paths from the domain folder. */
const filesHolding = (folder: string, code: string): ReadonlyArray<string> =>
    readdirSync(join(DOMAIN, folder), { recursive: true, encoding: "utf8" })
        .filter((file) => file.endsWith(".ts") && !file.endsWith(".spec.ts"))
        .filter((file) => readFileSync(join(DOMAIN, folder, file), "utf8").includes(code))
        .map((file) => `${folder}/${file.replaceAll("\\", "/")}`)
        .sort()

/** Every capability folder of the domain. */
const CAPABILITIES = readdirSync(DOMAIN, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

const everywhere = (code: string): ReadonlyArray<string> => CAPABILITIES.flatMap((folder) => filesHolding(folder, code))

describe("AgentWorkflowAdoptionService: every road by which a version becomes the one that runs", () => {
    it("writes a version row in two stores only, each behind the gate", () => {
        expect(filesHolding("agent-graphs", ".insertVersion(")).toEqual([
            "agent-graphs/agent-graphs.service.ts",
            "agent-graphs/agent-workflow-store.service.ts",
        ])
        // The workflow store refuses a write whose settlement is not the gate's for that graph; TypeScript makes the member required.
        expect(everywhere(".writeVersion(")).toEqual([
            "agent-graphs/agent-workflow-adoption.service.ts",
            "agent-graphs/agent-workflows.service.ts",
        ])
    })

    it("publishes a version of the agent's own graph from the known roads only", () => {
        // On its own transaction: a person's publish with no rows or of an agent's first flow (gated in the publish service), and the
        // seeds no person walks (their rows come at adoption).
        expect(everywhere("graphs.publish(")).toEqual([
            "agent-graphs/agent-graph-flow.service.ts",
            "agent-graphs/agent-graph-publish.service.ts",
            "agent-graphs/agent-graph-seed.service.ts",
        ])
        // Inside a transaction that also writes rows: the publish service with a primary workflow (the graph version and its rows,
        // written with no version, commit together; `stampOnce` names the mirroring workflow version after the commit), and the
        // mirror of a primary workflow version at the workflow store. With no rows, or for the first flow of an agent (whose rows
        // follow the adoption), the publish service publishes on its own (`graphs.publish(` above).
        expect(everywhere("graphs.publishIn(")).toEqual([
            "agent-graphs/agent-graph-publish.service.ts",
            "agent-graphs/agent-workflow-store.service.ts",
        ])
        expect(everywhere("graphs.ensure(")).toEqual([
            "agent-graphs/agent-graph-flow.service.ts",
            "agent-graphs/agent-graph-seed.service.ts",
        ])
    })

    it("turns a workflow on from the door that asks the gate first, and from the seed", () => {
        // The re-seed verb (`cli tools reseed`) moves a status too, but only to pause a workflow whose template is gone: never on.
        expect(everywhere("workflows.setStatus(")).toEqual([
            "agent-graphs/agent-workflows-admin.service.ts",
            "tool-reseed/tool-reseed.service.ts",
        ])
        const reseed = readFileSync(join(DOMAIN, "tool-reseed", "tool-reseed.service.ts"), "utf8")
        const calls = reseed.split("workflows.setStatus(").slice(1)
        expect(calls.length).toBeGreaterThan(0)
        expect(calls.every((call) => /^[^)]*"paused"\)/.test(call))).toBe(true)
        expect(everywhere("this.setStatus(")).toEqual(["agent-graphs/agent-workflows.service.ts"])
        expect(everywhere(".patchWorkflow(")).toEqual([
            "agent-graphs/agent-workflow-store.service.ts",
            "agent-graphs/agent-workflows.service.ts",
        ])
    })

    it("reaches the publish service from the doors that carry who publishes", () => {
        expect(everywhere("publishing.publish").concat(everywhere("publishing.restore("))).toEqual([
            "agent-graphs/agent-graph-admin.service.ts",
            "agent-graphs/agent-graph-setup.service.ts",
            "agent-graphs/agent-graph-admin.service.ts",
        ])
        expect(everywhere(".publishCopy(")).toEqual(["agent-instances/agent-setup-copy.service.ts"])
    })
})
