import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { agentWakeViewOf as endedWake } from "@tests/fixtures/builders/agent-work.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentEndedWakesService } from "./agent-ended-wakes.service"
import { AgentWorkHandlersService } from "./agent-work-handlers.service"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import type { AgentWorkFlow, AgentWorkHandler } from "./agent-work.port"

const build = async (handler: AgentWorkHandler | undefined, flow: AgentWorkFlow | undefined = undefined) => {
    const handlers = mock<AgentWorkHandlersService>({
        of: jest.fn().mockReturnValue(handler),
        flowOf: jest.fn().mockReturnValue(flow),
    })
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

    // DEF-5: a workflow call held behind the subject's own run burnt its tries while it waited and `begin` found it dead: the handler of
    // its source (none for a pipeline wake) said nothing, the customer's line was lost and nobody was told.
    it("a dead wake the flow takes as its own is reported by the flow (code attempts) and no handler speaks for it", async () => {
        const handler = handlerOf()
        const flow = mock<AgentWorkFlow>({ gaveUp: jest.fn().mockResolvedValue(true) })
        const { service, logger } = await build(handler, flow)
        const dead = endedWake({ wakeId: "wake-call" })

        await service.tell([{ state: "dead", wake: dead }])

        expect(flow.gaveUp).toHaveBeenCalledWith(dead, "attempts")
        expect(handler.holdOver).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.WakeDead, { agentId: "agent-1", wakeId: "wake-call" })
    })

    it("a dead wake that is not the flow's goes to its handler; a held wake never asks the flow", async () => {
        const handler = handlerOf()
        const flow = mock<AgentWorkFlow>({ gaveUp: jest.fn().mockResolvedValue(false) })
        const { service } = await build(handler, flow)
        const dead = endedWake({ wakeId: "wake-a" })
        const held = endedWake({ wakeId: "wake-b" })

        await service.tell([
            { state: "dead", wake: dead },
            { state: "held", wake: held },
        ])

        expect(flow.gaveUp.mock.calls).toEqual([[dead, "attempts"]])
        expect(handler.holdOver.mock.calls).toEqual([
            [dead, "error"],
            [held, "killed"],
        ])
    })

    it("a report of the flow that throws is logged and the handler still tells the dead wake", async () => {
        const handler = handlerOf()
        const flow = mock<AgentWorkFlow>({ gaveUp: jest.fn().mockRejectedValue(new Error("team chat down")) })
        const { service, logger } = await build(handler, flow)

        await service.tell([{ state: "dead", wake: endedWake({ wakeId: "wake-a" }) }])

        expect(logger.error).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFailed, expect.any(Error), { agentId: "agent-1", wakeId: "wake-a" })
        expect(handler.holdOver).toHaveBeenCalledWith(endedWake({ wakeId: "wake-a" }), "error")
    })
})
