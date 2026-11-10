import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PaymentTimersService } from "./payment-timers.service"
import { SalesEffectsLogEvent } from "./sales-effects.log-events"

const build = async (query: jest.Mock) => {
    const em = mockEntityManager()
    Object.assign(em, { query })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentTimersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { timers: moduleRef.get(PaymentTimersService), logger }
}

describe("PaymentTimersService", () => {
    it("drops the open reminder and stale check of the order, by their care keys, whatever agent holds them", async () => {
        const query = jest.fn().mockResolvedValue([[], 2])
        const { timers } = await build(query)

        await expect(timers.closeOf("ws-1", "o-1")).resolves.toBe(2)

        const [sql, values] = query.mock.calls[0] ?? []
        expect(String(sql)).toContain("status = 'dropped'")
        expect(String(sql)).toContain("status IN ('open', 'waiting')")
        expect(values).toEqual(["ws-1", ["care:payment-reminder:o-1", "care:payment-stale:o-1"]])
    })

    it("logs a close that failed and answers none: the reminder's own guard covers it, the settle is never failed for it", async () => {
        const { timers, logger } = await build(jest.fn().mockRejectedValue(new Error("db down")))
        await expect(timers.closeOf("ws-1", "o-1")).resolves.toBe(0)
        expect(logger.error).toHaveBeenCalledWith(SalesEffectsLogEvent.PaymentTimersCloseFailed, expect.any(Error), {
            orderId: "o-1",
        })
    })
})
