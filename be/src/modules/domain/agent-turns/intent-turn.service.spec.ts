import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { IntentContract } from "@modules/domain/intent-contracts"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AGENT_GRAPH_BRIEF, INTENT_FILES } from "./agent-turns.decorators"
import { AgentWriteRightService } from "./agent-write-right.service"
import { IntentTurnService } from "./intent-turn.service"
import type { IntentFileBundle, IntentFileRef, IntentPlan, IntentScope } from "./agent-turns.contracts"
import type { AgentGraphBrief, IntentFiles } from "./agent-turns.port"

const reply: IntentContract = {
    intent: "reply_customer",
    label: "Reply",
    risk: "none",
    task: "Answer the customer",
    limits: [],
    result: "customer_reply",
    owns: [],
    checks: [],
}

const confirm: IntentContract = { ...reply, intent: "confirm_order", label: "Confirm", risk: "write" }

const BUNDLE: IntentFileBundle = {
    parts: [{ kind: "file", text: "transfer 3tr5" }],
    attachments: [{ fileName: "bill.png", mimeType: "image/png", content: "AAAA" }],
    money: { amount: 3_500_000 },
}

const scope: IntentScope = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    source: "customer",
    authorUserId: null,
    pinned: null,
}

interface Options {
    readonly contracts?: ReadonlyArray<IntentContract> | null
    readonly mayWrite?: boolean
}

const build = async ({ contracts = [reply], mayWrite = false }: Options = {}) => {
    const graph = mock<AgentGraphBrief>({
        contractsOf: jest.fn(() => Promise.resolve(contracts === null ? null : { versionId: "v-1", contracts })),
        nodeKeysOf: jest.fn(() => Promise.resolve({ turn: "understand", acts: { confirm_order: "confirm" } })),
        raiseGap: jest.fn(() => Promise.resolve(true)),
    })
    const files = mock<IntentFiles>({ of: jest.fn(() => Promise.resolve(BUNDLE)) })
    const right = mock<AgentWriteRightService>({ mayWrite: jest.fn(() => Promise.resolve(mayWrite)) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            IntentTurnService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AgentWriteRightService, useValue: right },
            { provide: AGENT_GRAPH_BRIEF, useValue: graph },
            { provide: INTENT_FILES, useValue: files },
        ],
    }).compile()
    return { service: moduleRef.get(IntentTurnService), graph, right, files, catalog }
}

const NO_GRAPH: AgentGraphBrief | null = null
const NO_FILES: IntentFiles | null = null

/** The service as the app builds it before the graph and the chat files bind their ports. */
const buildBare = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            IntentTurnService,
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn() }) },
            { provide: AgentWriteRightService, useValue: mock<AgentWriteRightService>({ mayWrite: jest.fn() }) },
            { provide: AGENT_GRAPH_BRIEF, useValue: NO_GRAPH },
            { provide: INTENT_FILES, useValue: NO_FILES },
        ],
    }).compile()
    return moduleRef.get(IntentTurnService)
}

describe("IntentTurnService > the plan of a turn", () => {
    it("offers a customer message the contracts of the customer audience", async () => {
        const { service, graph, right } = await build()

        await expect(service.planFor(scope)).resolves.toEqual({
            versionId: "v-1",
            trigger: "customer_message",
            audience: "customer",
            pinned: null,
            contracts: [reply],
        })
        expect(graph.contractsOf).toHaveBeenCalledWith("ws-1", "agent-1", "customer_message", "customer")
        expect(right.mayWrite).not.toHaveBeenCalled()
    })

    it.each([
        [true, "manager"],
        [false, "staff"],
    ] as const)("offers a tag whose author may write=%s the %s audience", async (mayWrite, audience) => {
        const { service, graph, right } = await build({ mayWrite })

        const plan = await service.planFor({ ...scope, source: "tag", authorUserId: "user-1" })

        expect(plan?.audience).toBe(audience)
        expect(graph.contractsOf).toHaveBeenCalledWith("ws-1", "agent-1", "tag", audience)
        expect(right.mayWrite).toHaveBeenCalledWith("tag", "user-1", "ws-1")
    })

    it("offers a pinned turn the one contract it is pinned to", async () => {
        const { service } = await build({ contracts: [reply, confirm] })

        const plan = await service.planFor({ ...scope, pinned: "confirm_order" })

        expect(plan?.pinned).toBe("confirm_order")
        expect(plan?.contracts.map((item) => item.intent)).toEqual(["confirm_order"])
    })

    it.each([
        ["a graph that holds no contracts", { contracts: null }, scope],
        ["a source the pipeline does not serve", {}, { ...scope, source: "schedule" as const }],
    ])("leaves a turn on today's prompt for %s", async (_name, options, wakeScope) => {
        const { service } = await build(options)

        await expect(service.planFor(wakeScope)).resolves.toBeNull()
        await expect(service.pipelineOf(wakeScope)).resolves.toBe(false)
    })

    it("leaves a turn on today's prompt when no graph is bound", async () => {
        const service = await buildBare()

        await expect(service.planFor(scope)).resolves.toBeNull()
    })

    it("says a turn is on the pipeline when its plan exists", async () => {
        const { service } = await build()

        await expect(service.pipelineOf(scope)).resolves.toBe(true)
    })
})

describe("IntentTurnService > the prompt", () => {
    const plan: IntentPlan = {
        versionId: "v-1",
        trigger: "tag",
        audience: "manager",
        pinned: null,
        contracts: [reply],
    }

    it("builds the prompt from the identity line, the input as data and the contracts, saying each line in the turn's language", async () => {
        const { service, catalog } = await build()

        const planned = service.planOf(plan, "You are Mai.", [{ kind: "tag_message", text: "hello there" }], "en")

        expect(planned).toMatchObject({ ...plan })
        expect(planned.prompt).toContain("You are Mai.")
        expect(planned.prompt).toContain("hello there")
        expect(planned.prompt).toContain("reply_customer")
        const locales = catalog.get.mock.calls.map(([, , locale]) => locale)
        expect(locales.length).toBeGreaterThan(0)
        expect(new Set(locales)).toEqual(new Set(["en"]))
    })

    it("says a line that has no parameters with an empty set", async () => {
        const { service, catalog } = await build()

        service.planOf(plan, "id", [], "vi")

        expect(catalog.get.mock.calls.some(([, params]) => Object.keys(params).length === 0)).toBe(true)
    })
})

describe("IntentTurnService > the reading", () => {
    const plan: IntentPlan = {
        versionId: "v-1",
        trigger: "customer_message",
        audience: "customer",
        pinned: null,
        contracts: [reply, confirm],
    }
    const envelope = (intent: string, result: Readonly<Record<string, unknown>> = { reply: "50k" }): string =>
        JSON.stringify({ intent, result, gap: null })

    it("reads the model's text against the contracts it was offered", async () => {
        const { service } = await build()

        expect(service.readingOf(envelope("reply_customer"), plan)).toMatchObject({
            kind: "picked",
            contract: { intent: "reply_customer" },
        })
    })

    it("lets a first turn split on an intent that runs alone", async () => {
        const { service } = await build()

        expect(service.readingOf(envelope("confirm_order"), plan)).toMatchObject({
            kind: "split",
            contract: { intent: "confirm_order" },
        })
    })

    it("never lets a pinned turn split, and it picks the intent it is pinned to", async () => {
        const { service } = await build()
        const pinned: IntentPlan = { ...plan, pinned: "confirm_order", contracts: [confirm] }

        expect(service.readingOf(envelope("confirm_order"), pinned)).toMatchObject({ kind: "picked" })
    })

    it("takes the safe road for a text that is no envelope", async () => {
        const { service } = await build()

        expect(service.readingOf("just words", plan)).toMatchObject({ kind: "safe", cause: "invalid_output" })
    })

    it("builds the trace of a reading", async () => {
        const { service } = await build()

        const reading = service.readingOf(envelope("reply_customer"), plan)

        expect(service.traceOf(plan, reading)).toMatchObject({
            intent: "reply_customer",
            result: "picked",
            offered: ["reply_customer", "confirm_order"],
        })
    })
})

describe("IntentTurnService > the gap, the nodes and the files", () => {
    const gap = {
        workspaceId: "ws-1",
        agentId: "agent-1",
        versionId: "v-1",
        trigger: "tag",
        question: "Do you ship abroad?",
        topic: "shipping | abroad",
    } as const
    const ref: IntentFileRef = {
        workspaceId: "ws-1",
        kind: "customer",
        conversationId: "c1",
        messageId: "m1",
        threadId: null,
    }

    it("raises what was asked as a proposal to the owner through the graph, and false without a graph", async () => {
        const withGraph = await build()
        const without = await buildBare()

        await expect(withGraph.service.raiseGap(gap)).resolves.toBe(true)
        await expect(without.raiseGap(gap)).resolves.toBe(false)
        expect(withGraph.graph.raiseGap).toHaveBeenCalledWith(gap)
    })

    it("names the nodes of the published graph, and the node where the turn picks when no graph is bound", async () => {
        const withGraph = await build()
        const without = await buildBare()

        await expect(withGraph.service.nodeKeysOf("ws-1", "agent-1")).resolves.toEqual({
            turn: "understand",
            acts: { confirm_order: "confirm" },
        })
        await expect(without.nodeKeysOf("ws-1", "agent-1")).resolves.toEqual({ turn: "understand", acts: {} })
    })

    it("reads the files of a message through the chat files, and holds none when none are bound", async () => {
        const bound = await build()
        const unbound = await buildBare()

        await expect(bound.service.filesOf(ref)).resolves.toBe(BUNDLE)
        await expect(unbound.filesOf(ref)).resolves.toEqual({ parts: [], attachments: [], money: null })
        expect(bound.files.of).toHaveBeenCalledWith(ref)
    })
})
