import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import type { IntentContract } from "@modules/domain/intent-contracts"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AGENT_GRAPH_BRIEF } from "./agent-turns.decorators"
import { AgentWriteRightService } from "./agent-write-right.service"
import { IntentTurnService } from "./intent-turn.service"
import type { IntentPlan, IntentScope } from "./agent-turns.contracts"
import type { AgentGraphBrief } from "./agent-turns.port"

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
    readonly withGraph?: boolean
}

const build = async ({ contracts = [reply], mayWrite = false, withGraph = true }: Options = {}) => {
    const graph = mock<AgentGraphBrief>({
        contractsOf: jest.fn(() => Promise.resolve(contracts === null ? null : { versionId: "v-1", contracts })),
    })
    const right = mock<AgentWriteRightService>({ mayWrite: jest.fn(() => Promise.resolve(mayWrite)) })
    const gaps = mock<KnowledgeGapsService>({ record: jest.fn(() => Promise.resolve(null)) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            IntentTurnService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AgentWriteRightService, useValue: right },
            { provide: KnowledgeGapsService, useValue: gaps },
            ...(withGraph ? [{ provide: AGENT_GRAPH_BRIEF, useValue: graph }] : []),
        ],
    }).compile()
    return { service: moduleRef.get(IntentTurnService), graph, right, gaps, catalog }
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
        ["no graph bound", { withGraph: false }, scope],
        ["a source the pipeline does not serve", {}, { ...scope, source: "schedule" as const }],
    ])("leaves a turn on today's prompt for %s", async (_name, options, wakeScope) => {
        const { service } = await build(options)

        await expect(service.planFor(wakeScope)).resolves.toBeNull()
        await expect(service.pipelineOf(wakeScope)).resolves.toBe(false)
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

describe("IntentTurnService > the gap", () => {
    it("raises what was asked as an open question of the module", async () => {
        const { service, gaps } = await build()

        await service.raiseGap(
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                versionId: "v-1",
                trigger: "tag",
                question: "Do you ship abroad?",
                topic: "shipping | abroad",
            },
            "sales",
        )

        expect(gaps.record).toHaveBeenCalledWith("ws-1", {
            module: "sales",
            question: "Do you ship abroad?",
            topic: "shipping | abroad",
            source: "model",
        })
    })
})
