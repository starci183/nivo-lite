import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { LOGGER } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import type { Logger } from "@modules/platform/logging"
import type { StepView } from "./agent-runs.contracts"
import { AgentRunInflightService } from "./agent-run-inflight.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"

const noop = (): void => undefined

const timer = mock<Timer>()

const build = async (expires = true) => {
    timer.schedule.mockReset()
    timer.schedule.mockImplementation((callback) => {
        if (expires) callback()
        return noop
    })
    const released: Array<string> = []
    const logger = mock<Logger>()
    const ledger = mock<AgentStepLedgerService>({
        release: jest.fn((step: StepView) => {
            released.push(step.stepKey)
            return Promise.resolve(true)
        }),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunInflightService,
            { provide: LOGGER, useValue: logger },
            { provide: TIMER, useValue: timer },
            { provide: AgentStepLedgerService, useValue: ledger },
        ],
    }).compile()
    return { service: container.get(AgentRunInflightService), released, ledger, logger }
}

describe("AgentRunInflightService", () => {
    it("answers the result of the work it tracks and forgets the step when it ends", async () => {
        const { service, released } = await build()

        await expect(service.track(stepViewOf(), () => Promise.resolve("done"))).resolves.toBe("done")
        await service.beforeApplicationShutdown()

        expect(released).toEqual([])
    })

    it("refuses new claims once shutdown began", async () => {
        const { service } = await build()
        expect(service.closed).toBe(false)

        await service.beforeApplicationShutdown()

        expect(service.closed).toBe(true)
    })

    it("waits for a step that ends within the bound and gives nothing back", async () => {
        const { service, released } = await build(false)
        const tracked = service.track(stepViewOf({ stepKey: "quick" }), () => Promise.resolve(1))

        await service.beforeApplicationShutdown()
        await tracked

        expect(released).toEqual([])
    })

    it("gives back the claim of a step still running when the wait is over", async () => {
        const { service, released } = await build()
        const hung = service.track(stepViewOf({ stepKey: "hung" }), () => new Promise<never>(() => undefined))
        void hung.catch(noop)

        const shutting = service.beforeApplicationShutdown()
        await shutting

        expect(released).toEqual(["hung"])
    })

    it("logs a claim it could not give back and goes on", async () => {
        const { service, ledger, logger } = await build()
        ledger.release.mockRejectedValueOnce(new Error("db down"))
        const hung = service.track(stepViewOf({ stepKey: "hung" }), () => new Promise<never>(() => undefined))
        void hung.catch(noop)

        const shutting = service.beforeApplicationShutdown()
        await shutting

        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.ReleaseFailed, expect.any(Error), expect.anything())
    })
})
