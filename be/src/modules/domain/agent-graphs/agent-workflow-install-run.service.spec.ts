import { Test } from "@nestjs/testing"
import { AGENT_WORKFLOWS, AGENT_WORKFLOW_VERSIONS, workflowRecordOfRow, workflowVersionRecordOfRow } from "@tests/fixtures/builders/engine-core-tables.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    AccountAttachmentsService,
    NodeAccountConsentsService,
    type NodeAccountPolicyRecord,
} from "@modules/domain/tool-grants"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { storeDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { templateGraph } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentGraphFlowService } from "./agent-graph-flow.service"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphRightsService } from "./agent-graph-rights.service"
import { AgentRightsRecordsService } from "./agent-rights-records.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowInstallRunService } from "./agent-workflow-install-run.service"
import { AgentWorkflowInstallService } from "./agent-workflow-install.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"

const EMPTY = { nodes: [] }
const INSTALLED_NODES = nodeIndexOf(INSTALLED.nodeInstall())

/** One agent of the world: where it lives, what it runs, and how it came to be. */
interface Seat {
    readonly workspaceId: string
    readonly agentId: string
    readonly installationId: string
    readonly moduleKey: string
    /** `setup`: installed through the app, setup not applied. `applied`: the same, setup applied. `seeded`: the stack seed made it. */
    readonly made: "setup" | "applied" | "seeded"
}

const IN_SETUP: Seat = {
    workspaceId: "ws-app",
    agentId: "a-setup",
    installationId: "i-setup",
    moduleKey: "sales",
    made: "setup",
}
const APPLIED: Seat = {
    workspaceId: "ws-app",
    agentId: "a-applied",
    installationId: "i-applied",
    moduleKey: "chatbot",
    made: "applied",
}
const SEEDED: Seat = {
    workspaceId: "ws-nivo",
    agentId: "a-seeded",
    installationId: "i-seeded",
    moduleKey: "webbooks",
    made: "seeded",
}
const SEATS = [IN_SETUP, APPLIED, SEEDED]

/** The templates a module's plugin ships: how many, and how many are not the primary one. */
const shippedOf = (moduleKey: string): number => INSTALLED.templatesOf(moduleKey).length
const othersOf = (moduleKey: string): number =>
    INSTALLED.templatesOf(moduleKey).filter((template) => !template.primary).length

/**
 * Two workspaces: one made through the app (an agent still in setup, an agent whose setup was applied; neither holds a workflow)
 * and the seeded shop (its agent runs its flow and holds a workflow of every template). The run, the install and the workflow
 * services are the real ones on a memory engine.
 */
const build = async () => {
    const doubles = storeDoubles([
        AgentGraphsService,
        AgentGraphRecordsService,
        AgentGraphFlowService,
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
        AgentWorkflowInstallService,
        AgentWorkflowInstallRunService,
        AgentGraphRightsService,
        AgentRightsRecordsService,
    ])
    const grants: Array<NodeAccountPolicyRecord> = []
    const consents = mock<NodeAccountConsentsService>()
    consents.listOfWorkflow.mockResolvedValue([])
    consents.transaction.mockImplementation((work) => work(mockEntityManager()))
    consents.record.mockImplementation((_manager, records) => {
        grants.push(...records)
        return Promise.resolve(records.length)
    })
    doubles.memory.engine.within.mockImplementation((_manager, workspaceId, work) =>
        doubles.memory.engine.scoped(workspaceId, work),
    )
    const access = mock<AccountAttachmentsService>()
    access.listOfAgent.mockImplementation((_workspaceId, agentId) =>
        Promise.resolve([
            { agentId, connectionId: "c-zalo", provider: "zalo_oa", abilities: { "customer.send": "auto" as const } },
        ]),
    )
    const workspaces = mock<WorkspacesService>()
    workspaces.list.mockImplementation((_limit, after) =>
        Promise.resolve(
            after === undefined
                ? [
                      { id: "ws-app", name: "App" },
                      { id: "ws-nivo", name: "NIVO" },
                  ]
                : [],
        ),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            ...doubles.providers,
            { provide: AccountAttachmentsService, useValue: access },
            { provide: NodeAccountConsentsService, useValue: consents },
            { provide: WorkspacesService, useValue: workspaces },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({ installed: jest.fn().mockReturnValue(INSTALLED_NODES) }),
            },
        ],
    }).compile()
    const installations = moduleRef.get<ReturnType<typeof mock<InstallationRecordsService>>>(InstallationRecordsService)
    const recordOf = (seat: Seat): InstallationRecord =>
        mock<InstallationRecord>({
            id: seat.installationId,
            workspaceId: seat.workspaceId,
            agentId: seat.agentId,
            moduleKey: seat.moduleKey,
            activeContextVersionId: seat.made === "setup" ? null : `context-${seat.installationId}`,
        })
    installations.list.mockImplementation((workspaceId) =>
        Promise.resolve(SEATS.filter((seat) => seat.workspaceId === workspaceId).map(recordOf)),
    )
    const graphs = moduleRef.get(AgentGraphsService)
    const installer = moduleRef.get(AgentWorkflowInstallService)
    for (const seat of SEATS) {
        const { workspaceId, agentId, installationId } = seat
        const state = await graphs.ensure(workspaceId, agentId, installationId, EMPTY)
        const published = { workspaceId, agentId, note: "", memberId: null, contextVersionId: null }
        if (seat.made === "applied")
            await graphs.publish({ ...published, document: state.active ?? EMPTY, kind: "chat" })
        if (seat.made === "seeded") {
            // The stack seed: its spec is the flow, then every template of the module is a workflow.
            const flow = templateGraph("webbooks.payment")
            await graphs.publish({ ...published, document: { ...EMPTY, flow }, kind: "spec" })
            await installer.install(seat)
        }
    }
    grants.length = 0
    const lines: Array<string> = []
    const out = { write: (text: string) => lines.push(text.trimEnd()) }
    return {
        run: moduleRef.get(AgentWorkflowInstallRunService),
        graphs,
        grants,
        lines,
        out,
        memory: doubles.memory,
        logger: doubles.logger,
    }
}

type World = Awaited<ReturnType<typeof build>>

/** How many workflows each agent holds, and how many workflow versions exist at all. */
const standingOf = (world: World): ReadonlyArray<unknown> => {
    const held = world.memory.rows(AGENT_WORKFLOWS).map(workflowRecordOfRow)
    return [
        SEATS.map((seat) => held.filter((workflow) => workflow.agentId === seat.agentId).length),
        world.memory.rows(AGENT_WORKFLOW_VERSIONS).map(workflowVersionRecordOfRow).length,
    ]
}

describe("AgentWorkflowInstallRunService: every agent gets the workflows its plugin ships, once", () => {
    it("a dry run changes nothing and prints what it would add: the other templates for an agent in setup, the primary too where the setup is applied", async () => {
        const world = await build()
        const before = standingOf(world)

        const report = await world.run.run(world.out, {})

        const wanted = othersOf("sales") + shippedOf("chatbot")
        expect(report).toEqual({ executed: false, workspaces: 2, agents: 3, added: wanted, failed: 0 })
        expect(standingOf(world)).toEqual(before)
        expect(before).toEqual([[0, 0, shippedOf("webbooks")], expect.any(Number)])
        const text = world.lines.join("\n")
        expect(text).toContain("agent a-setup sales (setup not applied)")
        expect(text).toContain("(primary): primary waits: setup not applied")
        expect(text).toContain("agent a-applied chatbot (setup applied)")
        expect(world.lines.filter((line) => line.startsWith("    add ")).length).toBe(wanted)
        expect(world.lines.at(-1)).toBe(`install-workflows dry run: workspaces 2, agents 3, to add ${wanted}, failed 0`)
    })

    it("--execute makes exactly those workflows; the seeded shop is untouched; a second run adds nothing and says so", async () => {
        const world = await build()
        const seededBefore = standingOf(world)

        const first = await world.run.run(world.out, { execute: true })
        const after = standingOf(world)
        world.lines.length = 0
        const second = await world.run.run(world.out, { execute: true })

        expect(first.added).toBe(othersOf("sales") + shippedOf("chatbot"))
        expect(after).toEqual([[othersOf("sales"), shippedOf("chatbot"), shippedOf("webbooks")], expect.any(Number)])
        expect(seededBefore).toEqual([[0, 0, shippedOf("webbooks")], expect.any(Number)])
        expect(second).toEqual({ executed: true, workspaces: 2, agents: 3, added: 0, failed: 0 })
        expect(standingOf(world)).toEqual(after)
        expect(world.lines.slice(-2)).toEqual([
            "install-workflows executed: workspaces 2, agents 3, added 0, failed 0",
            "nothing to add",
        ])
        expect(world.lines.filter((line) => line.includes("a-seeded") || line.startsWith("    add")).length).toBe(1)
    })

    it("walks only the workspace named, and writes one log event per run with its counts", async () => {
        const world = await build()

        const report = await world.run.run(world.out, { workspaceId: "ws-nivo" })

        expect(report).toEqual({ executed: false, workspaces: 1, agents: 1, added: 0, failed: 0 })
        expect(world.logger.info).toHaveBeenCalledTimes(1)
        expect(world.logger.info).toHaveBeenCalledWith(AgentGraphsLogEvent.WorkflowInstallRun, report)
    })

    it("an agent that fails is printed and counted, and the agents after it are still done", async () => {
        const world = await build()
        const read = world.graphs.stateOfAgent.bind(world.graphs)
        const failure = new AgentGraphsError({ code: AgentGraphsErrorCode.RecordUnreadable })
        jest.spyOn(world.graphs, "stateOfAgent").mockImplementation((workspaceId, agentId) =>
            agentId === IN_SETUP.agentId ? Promise.reject(failure) : read(workspaceId, agentId),
        )

        const report = await world.run.run(world.out, { execute: true })

        expect(report).toMatchObject({ agents: 3, added: shippedOf("chatbot"), failed: 1 })
        expect(world.lines).toContain(`    FAILED ${AgentGraphsErrorCode.RecordUnreadable}`)
        expect(standingOf(world)).toEqual([[0, shippedOf("chatbot"), shippedOf("webbooks")], expect.any(Number)])
    })
})

// nivo-frame `rights`: no grant row is written at install (the node's mode is in the version, the attachments say which accounts).
describe("AgentWorkflowInstallRunService: the workflows it makes come with no rights row", () => {
    it("--execute makes the workflows and writes no row", async () => {
        const world = await build()

        const report = await world.run.run(world.out, { execute: true })

        expect(report.added).toBe(othersOf("sales") + shippedOf("chatbot"))
        expect(world.grants).toEqual([])
    })
})
