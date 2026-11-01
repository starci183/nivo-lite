import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentWorkHandlersService } from "./agent-work-handlers.service"
import { AGENT_TURN_EXECUTOR } from "./agent-work.decorators"
import type { AgentTurnExecutor, AgentWorkFallback, AgentWorkHandler } from "./agent-work.port"

const handler = (...sources: AgentWorkHandler["sources"]): AgentWorkHandler => mock<AgentWorkHandler>({ sources })

const executor = mock<AgentTurnExecutor>()

/** The token of an optional injection nothing bound: the kit mock reads an overridden `undefined` as absent, as the container does. */
const unbound = mock<{ readonly executor: AgentTurnExecutor | undefined }>({ executor: undefined }).executor

const build = async () => {
    const container = await Test.createTestingModule({
        providers: [AgentWorkHandlersService, { provide: AGENT_TURN_EXECUTOR, useValue: executor }],
    }).compile()
    return container.get(AgentWorkHandlersService)
}

const buildWithoutExecutor = async () => {
    const container = await Test.createTestingModule({
        providers: [AgentWorkHandlersService, { provide: AGENT_TURN_EXECUTOR, useValue: unbound }],
    }).compile()
    return container.get(AgentWorkHandlersService)
}

describe("AgentWorkHandlersService", () => {
    it("answers the handler registered for each source it names", async () => {
        const service = await build()
        const customer = handler("customer")
        const background = handler("internal", "schedule")

        service.add(customer)
        service.add(background)

        expect(service.of("customer")).toBe(customer)
        expect(service.of("internal")).toBe(background)
        expect(service.of("schedule")).toBe(background)
    })

    it("answers the executor the agent turns capability bound, and none while nothing is bound", async () => {
        const bound = await build()
        const bare = await buildWithoutExecutor()

        expect(bound.executorOf()).toBe(executor)
        expect(bare.executorOf()).toBeUndefined()
    })

    it("answers nothing for a source no handler has registered", async () => {
        const service = await build()

        expect(service.of("tag")).toBeUndefined()
    })

    it("refuses a second handler for a source, so a wiring bug fails at start", async () => {
        const service = await build()
        service.add(handler("tag"))

        expect(() => service.add(handler("tag", "customer"))).toThrow(
            new AgentWorkError({ code: AgentWorkErrorCode.HandlerDuplicate, params: { source: "tag" } }),
        )
        expect(service.of("customer")).toBeUndefined()
    })
})

describe("AgentWorkHandlersService fallbacks", () => {
    const fallback = (takes: string): AgentWorkFallback =>
        mock<AgentWorkFallback>({ sources: [], answers: jest.fn((source: string) => source === takes) })

    it("answers a source that has no handler of its own with the first fallback that takes it", async () => {
        const service = await build()
        const first = fallback("generic_webhook")
        const second = fallback("other_adapter")
        service.addFallback(first)
        service.addFallback(second)

        expect(service.of("generic_webhook")).toBe(first)
        expect(service.of("other_adapter")).toBe(second)
        expect(service.of("tag")).toBeUndefined()
    })

    it("prefers the handler registered for the source over any fallback", async () => {
        const service = await build()
        const own = handler("generic_webhook")
        service.addFallback(fallback("generic_webhook"))
        service.add(own)

        expect(service.of("generic_webhook")).toBe(own)
    })
})
