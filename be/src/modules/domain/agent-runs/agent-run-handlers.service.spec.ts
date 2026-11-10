import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import type { AgentStepHandler } from "./agent-runs.contracts"

const handler = (kind: string): AgentStepHandler => mock<AgentStepHandler>({ kind })

const build = async () => {
    const container = await Test.createTestingModule({ providers: [AgentRunHandlersService] }).compile()
    return container.get(AgentRunHandlersService)
}

describe("AgentRunHandlersService", () => {
    it("answers the handler registered for a kind", async () => {
        const service = await build()
        const turn = handler("turn")
        const door = handler("door")

        service.add(turn)
        service.add(door)

        expect(service.of("turn")).toBe(turn)
        expect(service.of("door")).toBe(door)
    })

    it("answers nothing for a kind no capability registered", async () => {
        const service = await build()

        expect(service.of("gateway_output")).toBeUndefined()
    })

    it("refuses a second handler for a kind, so a wiring bug fails at start", async () => {
        const service = await build()
        service.add(handler("turn"))

        expect(() => service.add(handler("turn"))).toThrow(
            new AgentRunsError({ code: AgentRunsErrorCode.HandlerDuplicate, params: { kind: "turn" } }),
        )
    })

    it("tells every listener that a run ended, in the order they registered", async () => {
        const service = await build()
        const told: Array<string> = []
        service.onEnded((workspaceId, runId) => Promise.resolve(void told.push(`a:${workspaceId}:${runId}`)))
        service.onEnded((_workspaceId, runId) => Promise.resolve(void told.push(`b:${runId}`)))

        await service.ended("ws-1", "run-1")

        expect(told).toEqual(["a:ws-1:run-1", "b:run-1"])
    })
})
