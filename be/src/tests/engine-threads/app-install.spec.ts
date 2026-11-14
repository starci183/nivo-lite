import { Test } from "@nestjs/testing"
import { AGENT_WORKFLOWS, AGENT_WORKFLOW_VERSIONS, workflowRecordOfRow, workflowVersionRecordOfRow } from "@tests/fixtures/builders/engine-core-tables.builder"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    AgentGraphFlowRunsService,
    AgentGraphRightsService,
    AgentGraphsService,
    AgentWorkflowInstallService,
    AgentWorkflowRunsService,
    AgentWorkflowsAdminService,
    AgentWorkflowsService,
    type FlowThreadRun,
    type FlowThreads,
} from "@modules/domain/agent-graphs"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { GraphNodeRegistryService, type NodeEffectExecutor } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    AccountAttachmentsService,
    NodeAccountConsentsService,
    NodeRightsSwitchService,
    type NodeAccountPolicyRecord,
} from "@modules/domain/tool-grants"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService, type MemberSeatRecord } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { storeDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentGraphFlowService } from "../../modules/domain/agent-graphs/agent-graph-flow.service"
import { AgentGraphLayoutService } from "../../modules/domain/agent-graphs/agent-graph-layout.service"
import { AgentGraphRecordsService } from "../../modules/domain/agent-graphs/agent-graph-records.service"
import { AgentRightsRecordsService } from "../../modules/domain/agent-graphs/agent-rights-records.service"
import { AgentGraphWakeNoticesService } from "../../modules/domain/agent-graphs/agent-graph-wake-notices.service"
import { AgentWorkflowAdoptionService } from "../../modules/domain/agent-graphs/agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "../../modules/domain/agent-graphs/agent-workflow-records.service"
import { AgentWorkflowStoreService } from "../../modules/domain/agent-graphs/agent-workflow-store.service"

// The release blocker of 2026-11-12: a workflow was made from a template by the stack seed alone, for one workspace by name, so an
// agent a person installed through the app held none and every wake to it ended with no handler. Here a workspace is made the way
// the app makes one (agents installed, each graph the seed its rules derive, NO flow, no workflow), and the app's doors give each
// agent its plugin's workflows through `AgentWorkflowInstallService`: the same two functions the stack seed calls.

const WS = "ws-1"
const CONV = "conv-1"
const CONTACT = "contact-1"
const EMPTY = { nodes: [] }

/** One agent installed through the app. */
interface Seat {
    readonly agentId: string
    readonly installationId: string
    readonly moduleKey: string
}

const CHATBOT: Seat = { agentId: "agent-chatbot", installationId: "inst-chatbot", moduleKey: "chatbot" }
const SALES: Seat = { agentId: "agent-sales", installationId: "inst-sales", moduleKey: "sales" }
const SEATS = [CHATBOT, SALES]

/** What the app installs: a template's graph is judged against it before it runs. */
const INSTALLED_NODES = nodeIndexOf(INSTALLED.nodeInstall())

/** The templates a module's plugin ships, as the installation declares them: the primary one, and the keys of the others. */
const primaryOf = (moduleKey: string): string | undefined =>
    INSTALLED.templatesOf(moduleKey).find((template) => template.primary)?.id
const othersOf = (moduleKey: string): ReadonlyArray<string> =>
    INSTALLED.templatesOf(moduleKey)
        .filter((template) => !template.primary)
        .map((template) => template.id)
        .sort()

const rowKeyOf = (row: NodeAccountPolicyRecord): string =>
    JSON.stringify([row.workflowId, row.nodeKey, row.connectionId, row.operation])

/** The grant store kept in memory: an owner's row replaces, any other row is only added, as the real store writes. */
const consentsOf = (grants: Array<NodeAccountPolicyRecord>) => {
    const consents = mock<NodeAccountConsentsService>()
    consents.listOfWorkflow.mockImplementation((_workspaceId, _agentId, workflowId) =>
        Promise.resolve(grants.filter((row) => row.workflowId === workflowId)),
    )
    consents.transaction.mockImplementation((work) => work(mockEntityManager()))
    consents.record.mockImplementation((_manager, records) => {
        for (const record of records) {
            const at = grants.findIndex((row) => rowKeyOf(row) === rowKeyOf(record))
            if (at === -1) grants.push(record)
            else if (record.origin === "owner") grants[at] = record
        }
        return Promise.resolve(records.length)
    })
    return consents
}

/**
 * A workspace made through the app: the chatbot and the sales agent are installed, each attached to the shop's Zalo account with
 * its send ticked (and the sales agent to the shop's SePay account unless `bank` is false), and each graph is the seed (no flow).
 * `decides` is the workspace's switch "node rights decide".
 */
const build = async (decides: boolean, bank = true) => {
    const doubles = storeDoubles([
        AgentGraphsService,
        AgentGraphRecordsService,
        AgentGraphFlowService,
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowRunsService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
        AgentWorkflowInstallService,
        AgentGraphRightsService,
        AgentRightsRecordsService,
        AgentGraphFlowRunsService,
        AgentGraphWakeNoticesService,
        AgentWorkflowsAdminService,
    ])
    const grants: Array<NodeAccountPolicyRecord> = []
    doubles.memory.engine.within.mockImplementation((_manager, workspaceId, work) =>
        doubles.memory.engine.scoped(workspaceId, work),
    )
    const access = mock<AccountAttachmentsService>()
    access.listOfAgent.mockImplementation((_workspaceId, agentId) =>
        Promise.resolve([
            { agentId, connectionId: "c-zalo", provider: "zalo_oa" },
            // The sales template's consult creates the transfer request on the shop's bank account (`request-payment`, SePay): a sales
            // agent that sells has it attached; without it its consult is not ready and shows to no wake (the readiness gate).
            ...(bank && agentId === SALES.agentId
                ? [{ agentId, connectionId: "c-sepay", provider: "sepay" }]
                : []),
        ]),
    )
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeSeatOfUser.mockImplementation((_workspaceId, userId) =>
        Promise.resolve(
            mock<MemberSeatRecord>(
                userId === "boss" ? { memberId: "member-1", role: "owner" } : { memberId: "member-2", role: "manager" },
            ),
        ),
    )
    /** The team chat's post: what the engine reports to the team, each report with the key the chat keeps one message per. */
    const reports: Array<{ readonly dedupeKey: unknown; readonly audience: unknown; readonly facts: unknown }> = []
    const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
    post.execute.mockImplementation((_turn, payload, options) => {
        reports.push({
            dedupeKey: options?.dedupeKey,
            audience: Reflect.get(Object(payload), "audience"),
            facts: Reflect.get(Object(payload), "facts"),
        })
        return Promise.resolve({ kind: "chat-message", id: "m-1" })
    })
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => key)
    /** The installations whose setup the owner applied: each then holds an applied context version. */
    const appliedSetups = new Set<string>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ...doubles.providers,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AccountAttachmentsService, useValue: access },
            { provide: NodeAccountConsentsService, useValue: consentsOf(grants) },
            {
                provide: NodeRightsSwitchService,
                useValue: mock<NodeRightsSwitchService>({ decides: jest.fn().mockResolvedValue(decides) }),
            },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: AgentGraphLayoutService, useValue: mock<AgentGraphLayoutService>() },
            { provide: AgentDirectoryService, useValue: mock<AgentDirectoryService>() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: fakeTransaction(mockEntityManager()).em },
            {
                provide: AgentRunsService,
                useValue: mock<AgentRunsService>({ open: jest.fn().mockResolvedValue(runViewOf({ id: "run-1" })) }),
            },
            { provide: AgentWorkHandlersService, useValue: mock<AgentWorkHandlersService>() },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({
                    installed: jest.fn().mockReturnValue(INSTALLED_NODES),
                    optionalExecutorOf: jest.fn().mockReturnValue(post),
                }),
            },
        ],
    }).compile()
    const installations = moduleRef.get<ReturnType<typeof mock<InstallationRecordsService>>>(InstallationRecordsService)
    const recordOf = (id: string) => {
        const seat = SEATS.find((one) => one.installationId === id)
        const activeContextVersionId = appliedSetups.has(id) ? `context-${id}` : null
        return Promise.resolve(
            seat === undefined
                ? null
                : mock<InstallationRecord>({ id, ...seat, name: seat.moduleKey, activeContextVersionId }),
        )
    }
    installations.find.mockImplementation((_workspaceId, id) => recordOf(id))
    installations.findById.mockImplementation((id) => recordOf(id))
    const graphs = moduleRef.get(AgentGraphsService)
    for (const seat of SEATS) await graphs.ensure(WS, seat.agentId, seat.installationId, EMPTY)
    const flows = moduleRef.get(AgentGraphFlowRunsService)
    const started: Array<FlowThreadRun> = []
    flows.setThreads(
        mock<FlowThreads>({
            owns: jest.fn().mockReturnValue(false),
            opened: jest.fn().mockResolvedValue(undefined),
            started: jest.fn((run: FlowThreadRun) => {
                started.push(run)
                return Promise.resolve({ status: "done" as const, reason: null, outcome: { runId: run.runId } })
            }),
        }),
    )
    const installer = moduleRef.get(AgentWorkflowInstallService)
    return {
        installer,
        graphs,
        flows,
        started,
        grants,
        reports,
        memory: doubles.memory,
        door: moduleRef.get(AgentWorkflowsAdminService),
        workflows: moduleRef.get(AgentWorkflowsService),
        /** The app's install door: the agent's templates become workflows. */
        install: (seat: Seat) => installer.install({ workspaceId: WS, ...seat }),
        /** The owner applies the agent's setup: its graph becomes one a person published, then the same door runs. */
        applied: async (seat: Seat) => {
            const state = await graphs.stateOfAgent(WS, seat.agentId)
            await graphs.publish({
                workspaceId: WS,
                agentId: seat.agentId,
                document: state?.active ?? EMPTY,
                kind: "chat",
                note: "",
                memberId: "member-1",
                contextVersionId: null,
            })
            appliedSetups.add(seat.installationId)
            return installer.install({ workspaceId: WS, ...seat })
        },
    }
}

type World = Awaited<ReturnType<typeof build>>

/** The workflows an agent holds: template, status, whether it is the primary one. */
const heldOf = (world: World, seat: Seat): ReadonlyArray<ReadonlyArray<unknown>> =>
    world.memory
        .rows(AGENT_WORKFLOWS)
        .map(workflowRecordOfRow)
        .filter((workflow) => workflow.agentId === seat.agentId)
        .map((workflow) => [workflow.template?.templateId, workflow.status, workflow.primary])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0])))

const versionCountOf = (world: World): number =>
    world.memory.rows(AGENT_WORKFLOW_VERSIONS).map(workflowVersionRecordOfRow).length

/** A customer's line on the shop's Zalo, as the channel door wakes the agent that answers the channel. */
const customerLine = (messageId = "m-1", conversationId = CONV): AgentTurnView =>
    agentTurnViewOf({
        workspaceId: WS,
        agentId: CHATBOT.agentId,
        source: "trigger",
        wakeId: `wake-${messageId}`,
        eventKey: messageId,
        scopeKey: `conversation:${conversationId}`,
        // As the one delivery writes the wake of a channel line: the verb, the event, the route; ids only, no words.
        context: { verb: TRIGGER.zaloMessageReceived, eventId: messageId, declaration: "zalo_oa:message.received", connectionId: "zalo-1", conversationId, contactId: CONTACT },
    })

/** A hand-off or a founder's tag pinned to one workflow of an agent by key, as `core.call-workflow` and the chat router write it. */
const pinned = (seat: Seat, workflow: string, from: Partial<AgentTurnView>): AgentTurnView =>
    agentTurnViewOf({
        workspaceId: WS,
        agentId: seat.agentId,
        source: "tag",
        wakeId: `wake-${workflow}`,
        ...from,
        context: {
            text: "x",
            tagContext: JSON.stringify({
                [WORKFLOW_CALL_MEMBER]: { workflow, version: "latest" },
                [WORKFLOW_PARAMS_MEMBER]: { conversationId: CONV, text: "x", channel: "zalo", leadId: "lead-1" },
            }),
            ...from.context,
        },
    })

const consultHandOff = (): AgentTurnView =>
    pinned(SALES, "consult", {
        scopeKey: `conversation:${CONV}`,
        context: { conversationId: CONV, channel: "zalo", authorAgentId: CHATBOT.agentId },
    })

const founderTag = (): AgentTurnView => pinned(SALES, "team-chat", { scopeKey: "agent", actorMemberId: "member-1" })

describe("an agent installed through the app gets the workflows its plugin ships", () => {
    it("install Sales: every other template of its plugin is a workflow at once; the primary one waits for the setup, and nothing takes a hand-off yet", async () => {
        const world = await build(false)

        const done = await world.install(SALES)

        expect(done).toEqual({ flow: "waits", made: othersOf("sales").length })
        expect(heldOf(world, SALES).map((held) => held[0])).toEqual(othersOf("sales"))
        expect(heldOf(world, SALES).every((held) => held[2] === false)).toBe(true)
        expect(othersOf("sales").length).toBeGreaterThan(0)
    })

    it("once the setup is applied the primary template is the flow the agent runs: a customer line wakes front-desk, its hand-off wakes consult, a founder's tag wakes team-chat", async () => {
        const world = await build(false)
        for (const seat of SEATS) {
            await world.install(seat)
            await expect(world.applied(seat)).resolves.toEqual({ flow: "published", made: 0 })
        }

        expect(heldOf(world, SALES)).toContainEqual([primaryOf("sales"), "active", true])
        expect(heldOf(world, CHATBOT)).toContainEqual([primaryOf("chatbot"), "active", true])
        for (const turn of [customerLine(), consultHandOff(), founderTag()]) {
            await expect(world.flows.takes(turn)).resolves.toBe(true)
            await expect(world.flows.run(turn)).resolves.toMatchObject({ status: "done" })
        }
        expect(world.started.map((run) => run.namespace)).toEqual([
            "chatbot.front-desk",
            "sales.consult",
            "sales.team-chat",
        ])
    })

    it("a sales agent with no bank account: its consult is not ready, so the consult hand-off goes nowhere (never the agent's own graph unpinned)", async () => {
        // DEFECT (reported, red until fixed): `AgentGraphFlowRunsService.flowOf` falls back to the agent's own active graph whenever the
        // routing finds no workflow, so a hand-off pinned to a workflow the readiness gate hides still runs that very graph, unpinned,
        // as `sales.main`: the gate is bypassed and the run is pinned to no workflow.
        const world = await build(false, false)
        for (const seat of SEATS) {
            await world.install(seat)
            await world.applied(seat)
        }

        await world.flows.run(consultHandOff())

        expect(world.started.map((run) => run.namespace)).not.toContain("sales.main")
        await expect(world.flows.takes(consultHandOff())).resolves.toBe(false)
    })

    it("before any install the same wakes are taken by nothing: the release blocker as it failed", async () => {
        const world = await build(false)

        await expect(world.flows.takes(consultHandOff())).resolves.toBe(false)
        await expect(world.flows.takes(founderTag())).resolves.toBe(false)
        await expect(world.flows.run(customerLine())).resolves.toMatchObject({
            status: "skipped",
            reason: "no_workflow",
        })
        expect(world.started).toEqual([])
    })
})

describe("installing again changes nothing, and what the workspace changed is kept", () => {
    it("a second install adds no workflow and no version; a second apply adds only the version it publishes itself; a paused workflow stays paused", async () => {
        const world = await build(false)
        await world.install(SALES)
        await world.applied(SALES)
        const paused = world.memory
            .rows(AGENT_WORKFLOWS)
            .map(workflowRecordOfRow)
            .find((workflow) => workflow.agentId === SALES.agentId && !workflow.primary)
        await world.workflows.setStatus(WS, paused?.id ?? "", "paused")
        const before = [
            heldOf(world, SALES),
            versionCountOf(world),
            await world.graphs.latestVersionOf(WS, SALES.agentId),
        ]

        await expect(world.install(SALES)).resolves.toEqual({ flow: "kept", made: 0 })
        await expect(world.install(SALES)).resolves.toEqual({ flow: "kept", made: 0 })
        const after = [
            heldOf(world, SALES),
            versionCountOf(world),
            await world.graphs.latestVersionOf(WS, SALES.agentId),
        ]
        // An apply publishes a graph version of its own; the primary workflow mirrors that one version, and nothing else moves.
        await expect(world.applied(SALES)).resolves.toEqual({ flow: "kept", made: 0 })

        expect(after).toEqual(before)
        expect([heldOf(world, SALES), versionCountOf(world)]).toEqual([before[0], Number(before[1]) + 1])
        expect(heldOf(world, SALES)).toContainEqual([paused?.template?.templateId, "paused", false])
    })

    it("a flow the agent already runs is never replaced by the template's, and a draft with an unpublished edit is left alone", async () => {
        const world = await build(false)
        await world.applied(CHATBOT)
        const own = (await world.graphs.stateOfAgent(WS, CHATBOT.agentId))?.active?.flow
        await world.install(CHATBOT)
        const editing = await build(false)
        await editing.applied(SALES)
        const state = await editing.graphs.stateOfAgent(WS, SALES.agentId)
        // The owner is half way through an edit of the published graph.
        await editing.graphs.saveDraft(WS, SALES.agentId, state?.draftRev ?? 0, { nodes: [] })

        expect((await world.graphs.stateOfAgent(WS, CHATBOT.agentId))?.active?.flow).toEqual(own)
        expect(own).toBeDefined()
        await expect(editing.install(SALES)).resolves.toMatchObject({ flow: "kept" })
    })
})

describe("an agent whose setup is not applied yet: it answers no customer, and the owner is never left in silence", () => {
    it("holds every workflow of its plugin but the primary one; a founder's tag wakes team-chat already", async () => {
        const world = await build(false)
        for (const seat of SEATS) await world.install(seat)

        expect(heldOf(world, CHATBOT).map((held) => held[0])).toEqual(othersOf("chatbot"))
        await expect(world.flows.takes(founderTag())).resolves.toBe(true)
        await expect(world.flows.run(founderTag())).resolves.toMatchObject({ status: "done" })
        expect(world.started.map((run) => run.namespace)).toEqual(["sales.team-chat"])
    })

    it("a customer line starts nothing and tells the TEAM once for the conversation: a second line adds no report, another conversation gets its own", async () => {
        const world = await build(false)
        for (const seat of SEATS) await world.install(seat)

        const first = await world.flows.run(customerLine("m-1"))
        const second = await world.flows.run(customerLine("m-2"))
        const elsewhere = await world.flows.run(customerLine("m-3", "conv-2"))

        expect([first, second, elsewhere]).toEqual(
            [1, 2, 3].map(() => ({ status: "skipped", reason: "no_workflow", outcome: null })),
        )
        // Nothing ran, so nothing was sent to the customer: no thread started for any of the three lines.
        expect(world.started).toEqual([])
        const [one, two, other] = world.reports.map((report) => report.dedupeKey)
        expect(one).toBe(`wake-notice:conversation:${CONV}:untaken:setup_not_applied`)
        expect(two).toBe(one)
        expect(other).toBe("wake-notice:conversation:conv-2:untaken:setup_not_applied")
        expect(new Set(world.reports.map((report) => report.dedupeKey)).size).toBe(2)
        expect(world.reports.every((report) => report.audience === "founder")).toBe(true)
        expect(JSON.stringify(world.reports[0]?.facts)).toContain("agentGraphs.wake.reason.setup_not_applied")
    })

    it("once the setup is applied the same line is answered by front-desk and no report is written", async () => {
        const world = await build(false)
        for (const seat of SEATS) {
            await world.install(seat)
            await world.applied(seat)
        }

        await expect(world.flows.run(customerLine("m-9"))).resolves.toMatchObject({ status: "done" })

        expect(world.started.map((run) => run.namespace)).toEqual(["chatbot.front-desk"])
        expect(world.reports).toEqual([])
    })
})
