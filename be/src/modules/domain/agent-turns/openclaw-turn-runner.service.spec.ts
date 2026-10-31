import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OPENCLAW_GATEWAY } from "@modules/integrations/openclaw"
import type { GatewayClient, RunUsage, TurnResult } from "@modules/integrations/openclaw"
import { OpenClawTurnRunnerService } from "./openclaw-turn-runner.service"
import type { AgentTurnRequest } from "./agent-turns.contracts"

const usage: RunUsage = { prompt_tokens: 10, completion_tokens: 4, cached_tokens: 2, cost: 0.01, model: "p/m" }

const request: AgentTurnRequest = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    module: "accounting",
    runtimeAgentId: "ws-aaaa1111-accounting",
    threadKey: "agent:ws-aaaa1111-accounting:work",
    message: "the words",
    runKey: "wake-w1:3",
    timeoutMs: 60_000,
}

const build = async (enabled = true, result: TurnResult = { text: "answer", usage, timings: {} }) => {
    const gateway = mock<GatewayClient>({ runTurn: jest.fn(() => Promise.resolve(result)) })
    Object.defineProperty(gateway, "enabled", { get: () => enabled })
    const moduleRef = await Test.createTestingModule({
        providers: [OpenClawTurnRunnerService, { provide: OPENCLAW_GATEWAY, useValue: gateway }],
    }).compile()
    return { runner: moduleRef.get(OpenClawTurnRunnerService), gateway }
}

describe("OpenClawTurnRunnerService", () => {
    it("says whether the gateway is configured", async () => {
        expect((await build(true)).runner.configured()).toBe(true)
        expect((await build(false)).runner.configured()).toBe(false)
    })

    it("maps the request onto the gateway turn: the runtime agent, the session, the replay key and the time limit", async () => {
        const { runner, gateway } = await build()

        await runner.run(request, new AbortController().signal)

        expect(gateway.runTurn).toHaveBeenCalledWith(
            {
                agentId: "ws-aaaa1111-accounting",
                threadKey: "agent:ws-aaaa1111-accounting:work",
                message: "the words",
                idempotencyKey: "wake-w1:3",
                timeoutMs: 60_000,
            },
            expect.any(AbortSignal),
        )
    })

    it("answers the text, the usage and the runtime agent that answered", async () => {
        const { runner } = await build()

        await expect(runner.run(request, new AbortController().signal)).resolves.toEqual({
            text: "answer",
            usage,
            runtimeAgentId: "ws-aaaa1111-accounting",
        })
    })

    it("answers a null usage when the gateway reported none", async () => {
        const { runner } = await build(true, { text: "x", usage: null, timings: {} })

        await expect(runner.run(request, new AbortController().signal)).resolves.toMatchObject({ usage: null })
    })

    it("hands the gateway a signal that follows the lease: aborting the drain's signal aborts the socket", async () => {
        const { runner, gateway } = await build()
        const drain = new AbortController()

        await runner.run(request, drain.signal)
        const [, given] = gateway.runTurn.mock.calls[0] ?? []
        expect(given?.aborted).toBe(false)
        drain.abort()

        expect(given?.aborted).toBe(true)
    })
})
