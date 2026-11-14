import { Test } from "@nestjs/testing"
import { AGENT_WORKFLOWS, workflowRecordOfRow } from "@tests/fixtures/builders/engine-core-tables.builder"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import {
    AgentGraphFlowRunsService,
    AgentWorkflowRunsService,
    AgentWorkflowsService,
    type FlowThreadRun,
    type FlowThreads,
} from "@modules/domain/agent-graphs"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentCard } from "@modules/domain/agents"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { WORKFLOW_CALL_TRIGGER } from "@modules/domain/agent-schedules/workflow-call.trigger"
import { ProviderTriggersService, type DeliverInput } from "@modules/domain/provider-triggers"
import { TeamChatStoreService, type PersonLineHeard } from "@modules/domain/team-chat"
import { TeamChatTurnsService } from "@modules/domain/team-chat-turns"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { MemberRow } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { workflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { DIRECT_SHIP_FEE_ASK_VI } from "@tests/fixtures/i18n/team-chat-turns-spec.messages"
import { AgentWorkflowAdoptionService } from "../../modules/domain/agent-graphs/agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "../../modules/domain/agent-graphs/agent-workflow-records.service"
import { AgentWorkflowStoreService } from "../../modules/domain/agent-graphs/agent-workflow-store.service"
import { ChatTurnLimiterService } from "../../modules/domain/team-chat-turns/chat-turn-limiter.service"

// N5 (2026-11-12): in a workspace made through the app, every line the founder wrote to an agent in /chat ended `agent_work.no_handler`.
// The router pins the agent's own `team-chat` workflow, and only the stack seed ever made a workflow from a template, for one workspace
// by name. Every routed spec ran in a seeded world (`workflowWorldOf`), so none saw an agent that holds no workflow.

const WS = "ws-1"
const OWNER = "u-owner"
const SALES = "agent-sales"
const DIRECT = "room-direct-sales"

const CARD: AgentCard = { id: SALES, name: "Sales", module: "sales" }
const PEOPLE: ReadonlyArray<MemberRow> = [
    { id: "seat-owner", user_id: OWNER, display_name: "Anh", role: "owner", status: "active" },
]

/** What the app installs: a template's graph is judged against it before it is copied. */
const INSTALLED_NODES = nodeIndexOf(INSTALLED.nodeInstall())

/** The founder's line in the private room with the Sales agent. */
const lineOf = (messageId: string): PersonLineHeard => ({
    workspaceId: WS,
    userId: OWNER,
    room: { id: DIRECT, kind: "direct", directKey: `agent:${SALES}|user:${OWNER}` },
    message: { id: messageId, body: DIRECT_SHIP_FEE_ASK_VI, createdAt: "2026-11-11T23:46:15.000Z" },
    agentMentions: [],
    repliedTo: null,
})

/** The wake the one delivery writes for a router's workflow call, as the drain hands it to the flow (ids, the verb, the pin, the data). */
const turnOf = (request: DeliverInput): AgentTurnView => {
    const given = request.events[0]
    return agentTurnViewOf({
        agentId: request.agentId ?? "nobody",
        source: "trigger",
        scopeKey: "agent",
        eventKey: `${request.declaration.verb}:${request.agentId ?? ""}:${given?.event.id ?? ""}`,
        actorMemberId: given?.actorMemberId ?? null,
        context: {
            verb: request.declaration.verb,
            eventId: given?.event.id ?? "",
            declaration: `${request.declaration.provider}:${request.declaration.name}`,
            dataJson: JSON.stringify(given?.event.data ?? {}),
            ...(given?.pin === undefined || given.pin === null ? {} : { tagContext: JSON.stringify({ workflowCall: given.pin }) }),
        },
    })
}

/**
 * A workspace made through the app, as the dev rows of the N5 run show it: the Sales agent is installed, its graph is the seed the
 * rules derive (a document with NO flow), and it holds no workflow at all. The router, the workflow services and the flow are the
 * real ones; `seeding` off is the router as it was before it gave an agent its chat-turn workflow.
 */
const build = async (seeding: boolean) => {
    const doubles = workflowDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowRunsService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
    ])
    doubles.graphs.stateOfAgent.mockResolvedValue(
        stateOf({ agentId: SALES, mode: "enforced", activeKind: "seed", active: { nodes: [] } }),
    )
    doubles.graphs.documentOf.mockResolvedValue({ nodes: [] })
    const requests: Array<DeliverInput> = []
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockImplementation((request) => {
        requests.push(request)
        return Promise.resolve({
            status: "delivered",
            events: 1,
            dropped: 0,
            woken: [{ agentId: request.agentId ?? "", workflowId: "w-1", eventId: request.events[0]?.event.id ?? "", wakeId: "wake-1" }],
            repeats: 0,
            untaken: 0,
            held: 0,
        })
    })
    const agents = mock<AgentDirectoryService>({ find: jest.fn().mockResolvedValue(CARD) })
    const members = mock<WorkspaceMembersReadService>({ directory: jest.fn().mockResolvedValue([...PEOPLE]) })
    const store = mock<TeamChatStoreService>({
        threadKeys: jest.fn().mockResolvedValue([]),
        messagesByIds: jest.fn().mockResolvedValue([]),
    })
    const limiter = mock<ChatTurnLimiterService>({ admit: jest.fn().mockReturnValue("run") })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ...doubles.providers,
            AgentGraphFlowRunsService,
            TeamChatTurnsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: fakeTransaction(mockEntityManager()).em },
            {
                provide: AgentRunsService,
                useValue: mock<AgentRunsService>({ open: jest.fn().mockResolvedValue(runViewOf({ id: "run-1" })) }),
            },
            { provide: AgentWorkHandlersService, useValue: mock<AgentWorkHandlersService>() },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({ installed: jest.fn().mockReturnValue(INSTALLED_NODES) }),
            },
            { provide: ChatTurnLimiterService, useValue: limiter },
            { provide: ProviderTriggersService, useValue: triggers },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMembersReadService, useValue: members },
            { provide: TeamChatStoreService, useValue: store },
        ],
    }).compile()
    const router = seeding
        ? moduleRef.get(TeamChatTurnsService)
        : new TeamChatTurnsService(fakeTransaction(mockEntityManager()).em, triggers, agents, members, store, limiter, doubles.logger)
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
    const records = () => doubles.memory.rows(AGENT_WORKFLOWS).map(workflowRecordOfRow)
    const held = () =>
        records().map((workflow) => [workflow.key, workflow.status, workflow.primary, workflow.template?.templateId])
    /** The wake of the router's latest call; a router that made none gives a wake of no agent, which nothing takes. */
    const wake = () =>
        turnOf(requests.at(-1) ?? { workspaceId: WS, declaration: WORKFLOW_CALL_TRIGGER, connectionId: null, agentId: "nobody", events: [] })
    return {
        router,
        flows,
        workflows: moduleRef.get(AgentWorkflowsService),
        started,
        records,
        held,
        wake,
        logger: doubles.logger,
    }
}

describe("the founder writes to an agent in /chat, in a workspace made through the app (no seed reached its agents)", () => {
    it("the first line gives the agent its chat-turn workflow, and the pinned wake runs it on a thread", async () => {
        const { router, flows, started, held, wake, logger } = await build(true)
        expect(held()).toEqual([])

        await expect(router.heard(lineOf("m-9"))).resolves.toEqual([SALES])

        expect(logger.error).not.toHaveBeenCalled()
        expect(held()).toEqual([["team-chat", "active", false, "sales.team-chat"]])
        await expect(flows.takes(wake())).resolves.toBe(true)
        await expect(flows.run(wake())).resolves.toMatchObject({ status: "done" })
        expect(started.map((run) => [run.namespace, run.flow.nodes.map((node) => node.step)])).toEqual([
            // Version 4 of the chat turn: the turn, then its proposal filed by a step of its own when it has one, then the answer posted,
            // then the check of a post a person declined (`core.when` is the graph's own `if`) and its `declined` outcome (`core.outcome`).
            ["sales.team-chat", ["team.chat", "core.when", "team.truth-propose", "team.answer-post", "core.when", "core.outcome"]],
        ])
    })

    it("a second line makes no second workflow, and a chat turn the owner switched off stays off", async () => {
        const { router, workflows, records, held } = await build(true)

        await router.heard(lineOf("m-9"))
        await router.heard(lineOf("m-10"))
        expect(held()).toEqual([["team-chat", "active", false, "sales.team-chat"]])

        await workflows.setStatus(WS, records()[0]?.id ?? "", "paused")
        await router.heard(lineOf("m-11"))

        expect(held()).toEqual([["team-chat", "paused", false, "sales.team-chat"]])
    })

    it("N5 as it failed: an agent with no chat-turn workflow has its pinned wake taken by nothing (the drain's no_handler)", async () => {
        const { router, flows, started, held, wake } = await build(false)

        await expect(router.heard(lineOf("m-9"))).resolves.toEqual([SALES])

        expect(held()).toEqual([])
        await expect(flows.takes(wake())).resolves.toBe(false)
        expect(started).toEqual([])
    })
})
