import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { agentWakeViewOf as endedWake } from "@tests/fixtures/builders/agent-work.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentEndedWakesService } from "./agent-ended-wakes.service"
import { AgentWorkHandlersService } from "./agent-work-handlers.service"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import type { AgentWorkHandler } from "./agent-work.port"

const build = async (handler: AgentWorkHandler | undefined) => {
    const handlers = mock<AgentWorkHandlersService>({ of: jest.fn().mockReturnValue(handler) })
    const logger = mock<Logger>()
    const container = await Test.createTestingModule({
        providers: [
            AgentEndedWakesService,
            { provide: AgentWorkHandlersService, useValue: handlers },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: container.get(AgentEndedWakesService), logger }
}

const handlerOf = () =>
    mock<AgentWorkHandler>({
        holdOver: jest.fn().mockResolvedValue({ status: "held", reason: "killed", outcome: null }),
    })

describe("AgentEndedWakesService.tell", () => {
    it("says the holding line of a wake the switch held, with the reason killed", async () => {
        const handler = handlerOf()
        const { service, logger } = await build(handler)

        await expect(service.tell([{ state: "held", wake: endedWake() }])).resolves.toBeUndefined()

        expect(handler.holdOver).toHaveBeenCalledWith(endedWake(), "killed")
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("logs a wake that died and tells its handler the reason error, in the order begin ended them", async () => {
        const handler = handlerOf()
        const { service, logger } = await build(handler)
        const first = endedWake({ wakeId: "wake-a" })
        const second = endedWake({ wakeId: "wake-b" })

        await service.tell([
            { state: "dead", wake: first },
            { state: "held", wake: second },
        ])

        expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.WakeDead, { agentId: "agent-1", wakeId: "wake-a" })
        expect(handler.holdOver.mock.calls).toEqual([
            [first, "error"],
            [second, "killed"],
        ])
    })

    it("logs a handler that fails and still tells the next wake", async () => {
        const handler = handlerOf()
        handler.holdOver.mockRejectedValueOnce(new Error("down"))
        const { service, logger } = await build(handler)

        await service.tell([
            { state: "held", wake: endedWake({ wakeId: "wake-a" }) },
            { state: "held", wake: endedWake({ wakeId: "wake-b" }) },
        ])

        expect(logger.error).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFailed, expect.any(Error), {
            agentId: "agent-1",
            wakeId: "wake-a",
        })
        expect(handler.holdOver).toHaveBeenCalledTimes(2)
    })

    it("leaves a wake alone when no handler is registered for its source", async () => {
        const { service, logger } = await build(undefined)

        await expect(service.tell([{ state: "held", wake: endedWake() }])).resolves.toBeUndefined()

        expect(logger.error).not.toHaveBeenCalled()
    })
})
