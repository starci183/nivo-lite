import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/blocks-core"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor } from "@modules/domain/graph-nodes"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphWakeNoticesService } from "./agent-graph-wake-notices.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"

/** A customer's line on a channel, as the drain hands it to the flow. */
const WAKE = agentTurnViewOf({ source: "customer", context: { conversationId: "conv-1", channel: "meta" } })

/** The catalogue as a test reads it: the key, then its fill-ins by name. */
const catalog = mock<MessageCatalog>({
    get: jest.fn(
        (key: string, params?: Readonly<Record<string, unknown>>) => `[${key}] ${JSON.stringify(params ?? {})}`,
    ),
})

const noticesOf = async (post: NodeEffectExecutor | undefined) => {
    const nodes = mock<GraphNodeRegistryService>({ optionalExecutorOf: jest.fn().mockReturnValue(post) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphWakeNoticesService,
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { notices: moduleRef.get(AgentGraphWakeNoticesService), nodes, logger }
}

describe("AgentGraphWakeNoticesService", () => {
    it("tells the founder alone, once per wake, that no workflow took a customer's line, with the channel, the conversation and why", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
        const { notices, nodes } = await noticesOf(post)

        await notices.untaken(WAKE, {
            reason: "no_trigger_takes_wake",
            running: ["front-desk"],
            sources: ["zalo", "telegram"],
        })

        expect(nodes.optionalExecutorOf).toHaveBeenCalledWith(TOOL.teamMessagePost)
        const [turn, payload, call] = post.execute.mock.calls[0] ?? []
        expect(turn).toMatchObject({ workspaceId: "ws-1", agentId: "agent-1", conversationId: null, origin: "system" })
        expect(payload).toMatchObject({ kind: "message.text", intent: "report", audience: "founder" })
        expect(payload?.title).toContain("agentGraphs.wake.untaken.title")
        expect(payload?.text).toContain('"channel":"meta"')
        expect(payload?.text).toContain('"conversation":"conv-1"')
        expect(payload?.text).toContain("agentGraphs.wake.reason.no_trigger_takes_wake")
        expect(payload?.text).toContain('"sources":"zalo, telegram"')
        expect(call).toEqual({ key: "wake-notice:wake-1:untaken", dedupeKey: "wake-notice:wake-1:untaken" })
    })

    it("tells the founder a wake that failed before any step, with its code, and writes nothing to the customer", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
        const { notices } = await noticesOf(post)

        await notices.failed(WAKE, "ENTITY_ENGINE_UNAVAILABLE")

        expect(post.execute).toHaveBeenCalledTimes(1)
        const [, payload, call] = post.execute.mock.calls[0] ?? []
        expect(payload?.text).toContain('"code":"ENTITY_ENGINE_UNAVAILABLE"')
        expect(call?.key).toBe("wake-notice:wake-1:failed:ENTITY_ENGINE_UNAVAILABLE")
    })

    it("never throws: an app with no team chat, or a chat that refuses the line, is logged", async () => {
        const none = await noticesOf(undefined)
        await expect(none.notices.failed(WAKE, "x")).resolves.toBeUndefined()
        expect(none.logger.warn).toHaveBeenCalled()

        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockRejectedValue(new Error("room gone"))
        const refusing = await noticesOf(post)
        await expect(refusing.notices.failed(WAKE, "x")).resolves.toBeUndefined()
        expect(refusing.logger.error).toHaveBeenCalled()
    })
})

/** The flow of an agent that has workflows, none of which routes the wake unless `route` answers one. */
const flowsOf = async (standing: { total: number; running: ReadonlyArray<string>; sources: ReadonlyArray<string> }) => {
    const workflows = mock<AgentWorkflowRunsService>()
    workflows.route.mockResolvedValue(null)
    workflows.standingOf.mockResolvedValue(standing)
    const wakeNotices = mock<AgentGraphWakeNoticesService>()
    const runs = mock<AgentRunsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphFlowRunsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: fakeTransaction(mockEntityManager()).em },
            {
                provide: AgentGraphsService,
                useValue: mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(null) }),
            },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentWorkHandlersService, useValue: mock<AgentWorkHandlersService>() },
            { provide: GraphNodeRegistryService, useValue: mock<GraphNodeRegistryService>() },
            { provide: AgentWorkflowRunsService, useValue: workflows },
            { provide: AgentGraphWakeNoticesService, useValue: wakeNotices },
        ],
    }).compile()
    return { flows: moduleRef.get(AgentGraphFlowRunsService), workflows, wakeNotices, runs }
}

describe("a customer wake of an agent that runs on workflows", () => {
    it("is the flow's even when no workflow takes it: it ends skipped, the founder is told why, and no run is opened", async () => {
        const { flows, wakeNotices, runs } = await flowsOf({
            total: 2,
            running: ["front-desk"],
            sources: ["zalo", "telegram"],
        })

        await expect(flows.takes(WAKE)).resolves.toBe(true)
        await expect(flows.run(WAKE)).resolves.toEqual({ status: "skipped", reason: "no_workflow", outcome: null })

        expect(wakeNotices.untaken).toHaveBeenCalledWith(WAKE, {
            reason: "no_trigger_takes_wake",
            running: ["front-desk"],
            sources: ["zalo", "telegram"],
        })
        expect(runs.open).not.toHaveBeenCalled()
    })

    it("says that no workflow runs when every workflow of the agent is switched off", async () => {
        const { flows, wakeNotices } = await flowsOf({ total: 1, running: [], sources: [] })

        await flows.run(WAKE)

        expect(wakeNotices.untaken).toHaveBeenCalledWith(WAKE, {
            reason: "no_workflow_running",
            running: [],
            sources: [],
        })
    })

    it("is the flow's when the agent has no workflow at all: the customer is told nothing, no run is opened, and the founder is told the agent has no workflow yet", async () => {
        const none = await flowsOf({ total: 0, running: [], sources: [] })

        await expect(none.flows.takes(WAKE)).resolves.toBe(true)
        await expect(none.flows.run(WAKE)).resolves.toEqual({ status: "skipped", reason: "no_workflow", outcome: null })

        expect(none.wakeNotices.untaken).toHaveBeenCalledTimes(1)
        expect(none.wakeNotices.untaken).toHaveBeenCalledWith(WAKE, { reason: "no_workflow", running: [], sources: [] })
        expect(none.runs.open).not.toHaveBeenCalled()
    })

    it("leaves a wake that is no customer's to the workflows that take it", async () => {

        const other = await flowsOf({ total: 2, running: ["front-desk"], sources: ["zalo"] })
        await expect(other.flows.takes({ ...WAKE, source: "schedule" })).resolves.toBe(false)
    })

    it("a routing that fails is no 'no workflow': the flow keeps the wake, the run throws so the wake is tried again, and the founder is told when it is given up", async () => {
        const { flows, workflows, wakeNotices } = await flowsOf({
            total: 2,
            running: ["front-desk"],
            sources: ["zalo"],
        })
        const cause = new Error("database down")
        workflows.route.mockRejectedValue(cause)

        await expect(flows.takes(WAKE)).resolves.toBe(true)
        await expect(flows.run(WAKE)).rejects.toBe(cause)
        expect(wakeNotices.untaken).not.toHaveBeenCalled()

        await flows.stuck(WAKE, "AGENT_WORK_UNEXPECTED")
        expect(wakeNotices.failed).toHaveBeenCalledWith(WAKE, "AGENT_WORK_UNEXPECTED")
    })
})
