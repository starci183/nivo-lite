import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
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

/** The words a test catalogue knows; any other key is missing (the catalogue answers the key itself). */
const WORDS: Readonly<Record<string, string>> = {
    "agentGraphs.wake.failed.title": "A turn could not run",
    "agentGraphs.wake.failed.sentence": "A turn stopped before the first step of a workflow, after its retries.",
    "agentGraphs.wake.untaken.title": "A customer message no workflow took",
    "agentGraphs.wake.untaken.sentence": "A customer message was handled by no workflow.",
    "agentGraphs.wake.reason.no_trigger_takes_wake": "no running workflow takes messages from this channel",
    "teamChat.fact.channel": "Channel",
    "teamChat.fact.reason": "Reason",
    "teamChat.fact.code": "Error code",
    "teamChat.fact.conversation": "Conversation id",
    "teamChat.fact.why": "Why",
    "teamChat.fact.sources": "Takes messages from",
    "teamChat.fact.running": "Workflows switched on",
    "teamChat.channel.meta": "Facebook Messenger",
    "teamChat.channel.zalo": "Zalo",
    "teamChat.channel.telegram": "Telegram",
    "errors.ENTITY_ENGINE_QUERY_INVALID": "The data read request is invalid.",
    "teamChat.reason.unknown": "A system error with no description yet.",
}

/** The catalogue as a test reads it: the words of a known key, the key itself for a missing one. */
const catalog = mock<MessageCatalog>({
    get: jest.fn((key: string) => WORDS[key] ?? key),
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

/** The payload a notice posted, as the team chat's executor gets it. */
const postedOf = (post: ReturnType<typeof mock<NodeEffectExecutor>>) => post.execute.mock.calls[0]?.[1]

describe("AgentGraphWakeNoticesService", () => {
    it("tells the founder alone, once per conversation and reason, that no workflow took a customer's line, as a typed report with worded facts", async () => {
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
        expect(payload).toEqual({
            kind: "report.facts",
            title: "A customer message no workflow took",
            text: "A customer message was handled by no workflow.",
            audience: "founder",
            facts: [
                { name: "Channel", value: "Facebook Messenger", technical: false },
                { name: "Why", value: "no running workflow takes messages from this channel", technical: false },
                { name: "Takes messages from", value: "Zalo, Telegram", technical: false },
                { name: "Workflows switched on", value: "front-desk", technical: true },
                { name: "Conversation id", value: "conv-1", technical: true },
            ],
        })
        const once = "wake-notice:conversation:conv-1:untaken:no_trigger_takes_wake"
        expect(call).toEqual({ key: once, dedupeKey: once })
    })

    it("tells the founder a wake that failed before any step: a readable sentence, the reason in words, the code only as a technical fact", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
        const { notices } = await noticesOf(post)

        await notices.failed(WAKE, "ENTITY_ENGINE_QUERY_INVALID")

        expect(post.execute).toHaveBeenCalledTimes(1)
        const payload = postedOf(post)
        expect(payload).toEqual({
            kind: "report.facts",
            title: "A turn could not run",
            text: "A turn stopped before the first step of a workflow, after its retries.",
            audience: "founder",
            facts: [
                { name: "Channel", value: "Facebook Messenger", technical: false },
                { name: "Reason", value: "The data read request is invalid.", technical: false },
                { name: "Error code", value: "ENTITY_ENGINE_QUERY_INVALID", technical: true },
                { name: "Conversation id", value: "conv-1", technical: true },
            ],
        })
        expect(post.execute.mock.calls[0]?.[2]?.key).toBe("wake-notice:wake-1:failed:ENTITY_ENGINE_QUERY_INVALID")
    })

    it("tells the founder a refused hand-off: the workflow it named, why, the providers it waits for, the code only as a technical fact", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
        const { notices } = await noticesOf(post)
        const handOff = agentTurnViewOf({ source: "tag", context: { conversationId: "conv-1", channel: "zalo" } })

        await notices.refused(handOff, { code: "call_target_hidden", workflow: "Consult", waitingFor: ["sepay", "casso"] })

        expect(postedOf(post)).toEqual({
            kind: "report.facts",
            title: "agentGraphs.wake.refused.title",
            text: "agentGraphs.wake.refused.sentence",
            audience: "founder",
            facts: [
                { name: "Channel", value: "Zalo", technical: false },
                { name: "workflow", value: "Consult", technical: false },
                { name: "Why", value: "agentGraphs.wake.reason.call_target_hidden", technical: false },
                { name: "waitingFor", value: "sepay, casso", technical: false },
                { name: "Error code", value: "call_target_hidden", technical: true },
                { name: "Conversation id", value: "conv-1", technical: true },
            ],
        })
        expect(post.execute.mock.calls[0]?.[2]?.key).toBe("wake-notice:wake-1:refused:call_target_hidden")
    })

    it("never puts a raw code, a channel id or a conversation id into the sentence or a worded fact", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
        const { notices } = await noticesOf(post)
        const wake = { ...WAKE, context: { conversationId: "a544428d-conv", channel: "sms-gateway" } }

        await notices.failed(wake, "SOME_UNMAPPED_CODE")

        const payload = postedOf(post)
        const facts = (payload?.facts ?? []) as ReadonlyArray<{ name: string; value: string; technical: boolean }>
        const shown = [
            String(payload?.text),
            ...facts.filter((fact) => !fact.technical).map((fact) => fact.value),
        ].join(" ")
        for (const raw of ["SOME_UNMAPPED_CODE", "a544428d-conv", "sms-gateway"]) expect(shown).not.toContain(raw)
        expect(facts.filter((fact) => fact.technical).map((fact) => fact.value)).toEqual([
            "sms-gateway",
            "SOME_UNMAPPED_CODE",
            "a544428d-conv",
        ])
        expect(facts.find((fact) => fact.name === "Reason")?.value).toBe("A system error with no description yet.")
    })

    it("names no channel and no conversation when the wake carries none", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
        const { notices } = await noticesOf(post)

        await notices.failed({ ...WAKE, context: {} }, "ENTITY_ENGINE_QUERY_INVALID")

        const facts = (postedOf(post)?.facts ?? []) as ReadonlyArray<{ name: string }>
        expect(facts.map((fact) => fact.name)).toEqual(["Reason", "Error code"])
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
    // A Zalo line as the one pipeline writes it (`deliver`: the verb, the route as `conversationId`, the account); the old `customer`
    // source is gone.
    const WAKE = agentTurnViewOf({
        source: "trigger",
        context: { verb: "nivo.trigger.zalo.message.received", conversationId: "conv-1", connectionId: "conn-1" },
    })

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
        await expect(other.flows.takes({ ...WAKE, source: "schedule", context: {} })).resolves.toBe(false)
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

describe("AgentGraphWakeNoticesService: an untaken customer line is told once per conversation", () => {
    const UNTAKEN = { reason: "setup_not_applied" as const, running: [], sources: [] }

    it("gives every line of one conversation the SAME report key, another conversation its own, and a wake of no conversation its own", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
        const { notices } = await noticesOf(post)
        const second = agentTurnViewOf({ ...WAKE, wakeId: "wake-2", eventKey: "msg-2" })
        const other = agentTurnViewOf({ ...WAKE, wakeId: "wake-3", context: { conversationId: "conv-2" } })
        const bare = agentTurnViewOf({ ...WAKE, wakeId: "wake-4", context: {} })

        await notices.untaken(WAKE, UNTAKEN)
        await notices.untaken(second, UNTAKEN)
        await notices.untaken(other, UNTAKEN)
        await notices.untaken(bare, UNTAKEN)

        expect(post.execute.mock.calls.map((call) => call[2]?.dedupeKey)).toEqual([
            "wake-notice:conversation:conv-1:untaken:setup_not_applied",
            "wake-notice:conversation:conv-1:untaken:setup_not_applied",
            "wake-notice:conversation:conv-2:untaken:setup_not_applied",
            "wake-notice:wake-4:untaken",
        ])
        // The team is told, never the customer: every report goes to the founder.
        expect(post.execute.mock.calls.every((call) => Reflect.get(Object(call[1]), "audience") === "founder")).toBe(
            true,
        )
    })
})

describe("AgentGraphWakeNoticesService: a wake no verb is derived for is told once", () => {
    it("tells the founder alone, once per wake, that a wake named no event any workflow listens for: why in words, the code only as a technical fact", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
        const { notices } = await noticesOf(post)
        const task = agentTurnViewOf({ source: "internal", context: { taskId: "task-1", subjectId: "task-1" } })

        await notices.unroutable(task)

        expect(post.execute).toHaveBeenCalledTimes(1)
        expect(postedOf(post)).toEqual({
            kind: "report.facts",
            title: "agentGraphs.wake.unroutable.title",
            text: "agentGraphs.wake.unroutable.sentence",
            audience: "founder",
            facts: [
                { name: "Why", value: "agentGraphs.wake.reason.no_trigger_verb", technical: false },
                { name: "Error code", value: "no_trigger_verb", technical: true },
            ],
        })
        const once = "wake-notice:wake-1:unroutable"
        expect(post.execute.mock.calls[0]?.[2]).toEqual({ key: once, dedupeKey: once })
    })
})
