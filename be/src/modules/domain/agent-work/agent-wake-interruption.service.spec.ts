import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { agentTurnViewOf as turn } from "@tests/fixtures/builders/agent-work.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentWakeInterruptionService } from "./agent-wake-interruption.service"
import { AGENT_WAKE_INTERRUPTIONS } from "./agent-work.decorators"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import type { WakeInterruptions } from "./agent-work.port"

const SIGNAL = new AbortController().signal

const interruptions = mock<WakeInterruptions>()

const buildBound = async () => {
    const told: Array<string> = []
    interruptions.interrupted.mockReset()
    interruptions.interrupted.mockImplementation((wakeId, code) => {
        told.push(`${wakeId}:${code}`)
        return Promise.resolve()
    })
    const logger = mock<Logger>()
    const container = await Test.createTestingModule({
        providers: [
            AgentWakeInterruptionService,
            { provide: LOGGER, useValue: logger },
            { provide: AGENT_WAKE_INTERRUPTIONS, useValue: interruptions },
        ],
    }).compile()
    return { service: container.get(AgentWakeInterruptionService), told, logger }
}

const buildBare = async () => {
    const container = await Test.createTestingModule({
        providers: [AgentWakeInterruptionService, { provide: LOGGER, useValue: mock<Logger>() }],
    }).compile()
    return container.get(AgentWakeInterruptionService)
}

describe("AgentWakeInterruptionService.tell", () => {
    it("tells the run of the wake that the runtime went down", async () => {
        const { service, told } = await buildBound()

        await service.tell(turn(), SIGNAL)

        expect(told).toEqual(["wake-1:runtime_down"])
    })

    it("logs a run that cannot be told, and never fails the drain", async () => {
        const { service, logger } = await buildBound()
        interruptions.interrupted.mockRejectedValue(new Error("db down"))

        await expect(service.tell(turn(), SIGNAL)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFailed, expect.any(Error), {
            agentId: "agent-1",
            wakeId: "wake-1",
        })
    })

    it("tells nobody when no runs are bound", async () => {
        const service = await buildBare()

        await expect(service.tell(turn(), SIGNAL)).resolves.toBeUndefined()
    })
})
