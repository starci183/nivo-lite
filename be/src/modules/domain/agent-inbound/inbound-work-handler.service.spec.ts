import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { agentTurnViewOf, agentWakeViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { AgentRunsService } from "@modules/domain/agent-runs"
import {
    AGENT_GRAPH_BRIEF,
    IntentPipelineService,
    IntentTurnService,
    RuntimeAgentService,
} from "@modules/domain/agent-turns"
import type { AgentGraphBrief, IntentPlan } from "@modules/domain/agent-turns"
import { AgentWorkHandlersService, encodeInbound } from "@modules/domain/agent-work"
import type { AgentTurnView, AgentWakeInbound } from "@modules/domain/agent-work"
import { AGENTS_INSTALLATIONS, AgentDirectoryService, AgentsService } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import type { IntentContract } from "@modules/domain/intent-contracts"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { INBOUND_ADAPTER_REGISTRY } from "./agent-inbound.decorators"
import { InboundWorkHandlerService } from "./inbound-work-handler.service"
import type { InboundAdapter } from "./agent-inbound.contracts"
import type { InboundAdapterRegistry } from "./agent-inbound.port"

const KEY = "handler_spec_hook"
const REPLYING = "handler_spec_reply"

const adapterOf = (key: string, replyStep: string | null): InboundAdapter => ({
    key,
    authentication: "signature",
    trustOf: () => "outsider",
    awaitsAnswer: false,
    replyStep,
    doorStep: "webhook_door",
    priority: 28,
    maxAttempts: 3,
})

const inbound = (eventType: string, trust = "outsider"): AgentWakeInbound => ({
    eventType,
    actor: { kind: "webhook", id: "conn-1", role: null },
    trust,
    chain: null,
    payload: { amount: 1 },
    attachments: [],
    evidence: [],
})

const contract = (intent: string): IntentContract => ({
    intent,
    label: intent,
    risk: "none",
    task: "",
    limits: [],
    result: "customer_reply",
    owns: [],
    checks: [],
})

const PLAN: IntentPlan = {
    versionId: "v-1",
    trigger: "tag",
    audience: "customer",
    pinned: null,
    contracts: [contract("reply_customer")],
}

const turnOf = (over: Partial<AgentTurnView> = {}, event: AgentWakeInbound | null = inbound("tag")): AgentTurnView =>
    agentTurnViewOf({
        source: KEY,
        scopeKey: "agent",
        context: event === null ? {} : { inbound: encodeInbound(event) },
        ...over,
    })

interface Options {
    readonly contracts?: { readonly versionId: string; readonly contracts: ReadonlyArray<IntentContract> } | null
    readonly active?: boolean
    readonly named?: boolean
}

const build = async ({
    contracts = { versionId: "v-1", contracts: [contract("reply_customer")] },
    active = true,
    named = true,
}: Options = {}) => {
    const adapters = new Map(
        [KEY, REPLYING].map((key) => [key, adapterOf(key, key === REPLYING ? "final_reply_spec" : null)]),
    )
    const registry = mock<InboundAdapterRegistry>({ lookup: jest.fn((key: string) => adapters.get(key)) })
    const handlers = mock<AgentWorkHandlersService>({ addFallback: jest.fn() })
    const graph = mock<AgentGraphBrief>({ contractsOf: jest.fn().mockResolvedValue(contracts) })
    const intents = mock<IntentTurnService>({
        planOf: jest.fn().mockImplementation((plan: IntentPlan) => ({ ...plan, prompt: "the five-part prompt" })),
    })
    const pipeline = mock<IntentPipelineService>({
        open: jest.fn().mockResolvedValue(undefined),
        read: jest.fn().mockResolvedValue({ reading: { kind: "safe" }, trace: { result: "no_intent" } }),
        door: jest.fn().mockResolvedValue({ opened: false }),
    })
    const runs = mock<AgentRunsService>({ runInline: jest.fn().mockResolvedValue({}) })
    const directory = mock<AgentDirectoryService>({
        chatFactsOf: jest.fn().mockResolvedValue(active ? { module: "accounting", status: "active" } : null),
    })
    const agents = mock<AgentsService>({ profileOf: jest.fn().mockResolvedValue(named ? { name: "Ledger" } : null) })
    const runtime = mock<RuntimeAgentService>({ agentFor: jest.fn().mockResolvedValue("runtime-1") })
    const installations = mock<InstallationDirectory>({ ofAgent: jest.fn().mockResolvedValue(null) })
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>({ get: jest.fn().mockReturnValue("You are Ledger.") })
    const container = await Test.createTestingModule({
        providers: [
            InboundWorkHandlerService,
            { provide: INBOUND_ADAPTER_REGISTRY, useValue: registry },
            { provide: AgentWorkHandlersService, useValue: handlers },
            { provide: AGENT_GRAPH_BRIEF, useValue: graph },
            { provide: IntentTurnService, useValue: intents },
            { provide: IntentPipelineService, useValue: pipeline },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentDirectoryService, useValue: directory },
            { provide: AgentsService, useValue: agents },
            { provide: RuntimeAgentService, useValue: runtime },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: LOGGER, useValue: logger },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return {
        handler: container.get(InboundWorkHandlerService),
        handlers,
        graph,
        intents,
        pipeline,
        runs,
        runtime,
        logger,
        catalog,
    }
}

const SIGNAL = new AbortController().signal

describe("InboundWorkHandlerService registration", () => {
    it("registers itself as the fallback of the drain once the app has started", async () => {
        const { handler, handlers } = await build()

        handler.onModuleInit()

        expect(handlers.addFallback).toHaveBeenCalledWith(handler)
    })

    it("takes a registered adapter that is not one of the four built-in sources, and nothing else", async () => {
        const { handler } = await build()

        expect(handler.answers(KEY)).toBe(true)
        expect(handler.answers("customer")).toBe(false)
        expect(handler.answers("tag")).toBe(false)
        expect(handler.answers("handler_spec_nobody")).toBe(false)
    })
})

describe("InboundWorkHandlerService.prepare", () => {
    it("offers the model the contracts of the trigger and the audience the trust gives, with the event as data, and opens the run", async () => {
        const { handler, graph, intents, pipeline, runtime } = await build()
        const turn = turnOf()

        const prep = await handler.prepare(turn)

        expect(graph.contractsOf).toHaveBeenCalledWith("ws-1", "agent-1", "tag", "customer")
        expect(intents.planOf).toHaveBeenCalledWith(
            PLAN,
            "You are Ledger.",
            [{ kind: "inbound_event", text: 'tag\n{"amount":1}' }],
            "vi",
        )
        expect(pipeline.open).toHaveBeenCalledWith(turn, expect.objectContaining({ prompt: "the five-part prompt" }))
        expect(runtime.agentFor).toHaveBeenCalledWith("ws-1", "accounting", null)
        expect(prep).toMatchObject({
            kind: "run",
            plan: { module: "accounting", runtimeAgentId: "runtime-1", message: "the five-part prompt" },
        })
    })

    it("pins the offer to one contract on a follow-up turn", async () => {
        const { handler, intents } = await build({
            contracts: { versionId: "v-1", contracts: [contract("reply_customer"), contract("confirm_order")] },
        })

        await handler.prepare(turnOf({ context: { inbound: encodeInbound(inbound("tag")), intent: "confirm_order" } }))

        expect(intents.planOf).toHaveBeenCalledWith(
            { ...PLAN, pinned: "confirm_order", contracts: [contract("confirm_order")] },
            "You are Ledger.",
            [{ kind: "inbound_event", text: 'tag\n{"amount":1}' }],
            "vi",
        )
    })

    it.each([
        ["a wake with no event", turnOf({}, null), "no_event"],
        ["an event no contract frame accepts", turnOf({}, inbound("invoice.paid")), "no_contract"],
    ])("ends %s as skipped with its reason and never calls the model", async (_name, turn, reason) => {
        const { handler, pipeline } = await build()

        await expect(handler.prepare(turn)).resolves.toEqual({
            kind: "end",
            ending: { status: "skipped", reason, outcome: null },
        })
        expect(pipeline.open).not.toHaveBeenCalled()
    })

    it("ends the wake as skipped when the published graph holds no contract for the trigger", async () => {
        const { handler } = await build({ contracts: null })

        await expect(handler.prepare(turnOf())).resolves.toMatchObject({
            kind: "end",
            ending: { reason: "no_contract" },
        })
    })

    it("ends the wake as skipped when the agent is gone or paused", async () => {
        const { handler, runtime } = await build({ active: false })

        await expect(handler.prepare(turnOf())).resolves.toMatchObject({
            kind: "end",
            ending: { reason: "agent_inactive" },
        })
        expect(runtime.agentFor).not.toHaveBeenCalled()
    })

    it("ends the wake when the agent has no profile", async () => {
        const { handler } = await build({ named: false })

        await expect(handler.prepare(turnOf())).resolves.toMatchObject({
            kind: "end",
            ending: { reason: "agent_inactive" },
        })
    })
})

describe("InboundWorkHandlerService.settle", () => {
    it("reads the text against the contracts, acts through the door the adapter declares, and replies to nobody when it has no reply step", async () => {
        const { handler, pipeline, runs } = await build()
        const turn = turnOf()

        const ending = await handler.settle(turn, { text: "the model said" }, SIGNAL)

        expect(pipeline.read).toHaveBeenCalledWith(turn, PLAN, "the model said", SIGNAL)
        expect(pipeline.door).toHaveBeenCalledWith(turn, "webhook_door", expect.anything(), SIGNAL)
        expect(runs.runInline).not.toHaveBeenCalled()
        expect(ending).toEqual({
            status: "done",
            reason: null,
            outcome: { opened: false, intent: { result: "no_intent" }, replied: false },
        })
    })

    it("sends the answer through the reply step the adapter declares", async () => {
        const { handler, runs } = await build()
        const turn = turnOf({ source: REPLYING, wakeId: "wake-5" })

        const ending = await handler.settle(turn, { text: "ok" }, SIGNAL)

        expect(runs.runInline).toHaveBeenCalledWith(
            "wake-5",
            {
                stepKey: "final_reply",
                nodeKey: "intent_reply",
                kind: "final_reply_spec",
                effect: { kind: "pivot" },
                input: { wakeId: "wake-5", agentId: "agent-1", workspaceId: "ws-1", door: { opened: false } },
            },
            SIGNAL,
        )
        expect(ending).toMatchObject({ outcome: { replied: true } })
    })

    it("reads an empty text from a proposal that has none", async () => {
        const { handler, pipeline } = await build()

        await handler.settle(turnOf(), "not a proposal", SIGNAL)

        expect(pipeline.read).toHaveBeenCalledWith(expect.anything(), PLAN, "", SIGNAL)
    })

    it("skips a wake with no event, and a wake whose contracts are gone", async () => {
        const gone = await build({ contracts: null })
        const bare = await build()

        await expect(gone.handler.settle(turnOf(), { text: "x" }, SIGNAL)).resolves.toMatchObject({
            status: "skipped",
            reason: "no_contract",
        })
        await expect(bare.handler.settle(turnOf({}, null), { text: "x" }, SIGNAL)).resolves.toMatchObject({
            status: "skipped",
            reason: "no_event",
        })
    })
})

describe("InboundWorkHandlerService.holdOver", () => {
    it("holds a wake that cannot run, with its reason, and logs it", async () => {
        const { handler, logger } = await build()

        await expect(handler.holdOver(agentWakeViewOf({ source: KEY }), "killed")).resolves.toEqual({
            status: "held",
            reason: "killed",
            outcome: null,
        })
        expect(logger.info).toHaveBeenCalledWith("agent_inbound.wake_ended", {
            agentId: "agent-1",
            wakeId: "wake-2",
            reason: "killed",
        })
    })
})
