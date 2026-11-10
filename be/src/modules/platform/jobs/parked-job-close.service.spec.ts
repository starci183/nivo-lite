import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { JobsLogEvent } from "./jobs.log-events"
import { ParkedJobCloseService } from "./parked-job-close.service"
import { JobEntity } from "./persistence/entities"

const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [ParkedJobCloseService, { provide: LOGGER, useValue: logger }],
    }).compile()
    return { closer: moduleRef.get(ParkedJobCloseService), logger }
}

describe("ParkedJobCloseService", () => {
    it("closes a parked job: failed for good with the reason as its error, no longer parked, so the sweep never hands it back", async () => {
        const em = mockEntityManager({})
        em.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] })
        const { closer, logger } = await build()

        await expect(closer.close(em, "j-1", "old test payment")).resolves.toBe(true)

        expect(em.update).toHaveBeenCalledTimes(1)
        expect(em.update).toHaveBeenCalledWith(
            JobEntity,
            { id: "j-1", status: "failed_awaiting_fix" },
            { status: "failed", error: "closed: old test payment", parkedBuild: null, parkedAt: null },
        )
        expect(logger.info).toHaveBeenCalledWith(JobsLogEvent.Closed, { jobId: "j-1", reason: "old test payment" })
    })

    it("refuses a job that is not parked (running, done, handed back, or unknown) and changes nothing", async () => {
        const em = mockEntityManager({})
        em.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] })
        const { closer, logger } = await build()

        await expect(closer.close(em, "j-9", "why")).resolves.toBe(false)

        expect(em.update.mock.calls[0]?.[1]).toEqual({ id: "j-9", status: "failed_awaiting_fix" })
        expect(logger.info).not.toHaveBeenCalled()
    })
})
