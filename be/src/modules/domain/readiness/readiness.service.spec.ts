import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { READ_DATABASE_PROBE } from "./persistence/readiness.sql"
import { ReadinessLogEvent } from "./readiness.log-events"
import { ReadinessService } from "./readiness.service"

const DRIVER_MESSAGE = "connection refused at postgres://private-user:private-password@database.internal/primary"
const UNREADY = { status: "unready", checks: { database: "down" } }

const build = async (em: MockEntityManager) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReadinessService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(ReadinessService), logger }
}

describe("ReadinessService", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it("reports ok when the primary database answers the read-only probe and cancels its deadline", async () => {
        const em = mockEntityManager({ query: [READ_DATABASE_PROBE, [{ one: 1 }]] })
        const { service, logger } = await build(em)

        await expect(service.check()).resolves.toEqual({ status: "ok", checks: { database: "ok" } })

        expect(em.query).toHaveBeenCalledWith(READ_DATABASE_PROBE)
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(jest.getTimerCount()).toBe(0)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("reports unready after a rejected query without exposing the driver error in the output or logs", async () => {
        const em = mockEntityManager()
        em.query.mockRejectedValue(new Error(DRIVER_MESSAGE))
        const { service, logger } = await build(em)

        const report = await service.check()

        expect(report).toEqual(UNREADY)
        expect(logger.error).toHaveBeenCalledWith(
            ReadinessLogEvent.DatabaseUnavailable,
            "The primary database probe failed.",
            { timeoutMs: 2000 },
        )
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(JSON.stringify({ report, logs: logger.error.mock.calls })).not.toContain(DRIVER_MESSAGE)
        expect(logger.info).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
        expect(jest.getTimerCount()).toBe(0)
    })

    it("reports unready at 2000 ms when the query does not answer and ignores a later driver rejection", async () => {
        const em = mockEntityManager()
        let rejectQuery: (cause: Error) => void = () => undefined
        em.query.mockImplementationOnce(
            () =>
                new Promise<unknown>((_resolve, reject) => {
                    rejectQuery = reject
                }),
        )
        const { service, logger } = await build(em)
        let answered = false
        const checking = service.check().then((report) => {
            answered = true
            return report
        })

        await jest.advanceTimersByTimeAsync(1999)
        expect(answered).toBe(false)
        expect(logger.error).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(1)
        const report = await checking
        rejectQuery(new Error(DRIVER_MESSAGE))
        await jest.advanceTimersByTimeAsync(0)

        expect(report).toEqual(UNREADY)
        expect(logger.error).toHaveBeenCalledWith(
            ReadinessLogEvent.DatabaseUnavailable,
            "The primary database probe timed out.",
            { timeoutMs: 2000 },
        )
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(JSON.stringify({ report, logs: logger.error.mock.calls })).not.toContain(DRIVER_MESSAGE)
        expect(logger.info).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
        expect(jest.getTimerCount()).toBe(0)
    })
})
