import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { JobsLogEvent } from "./jobs.log-events"
import { ParkedJobCloseService, type CommandExit } from "./parked-job-close.service"
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

describe("ParkedJobCloseService.closeFor", () => {
    const JOB = "2d7314f3-50ce-4c41-820a-2ba6902be647"

    const run = async (jobId: string | undefined, reason: string | undefined, affected: number) => {
        const em = mockEntityManager({})
        em.update.mockResolvedValue({ affected, raw: [], generatedMaps: [] })
        const { closer } = await build()
        const out = { write: jest.fn() }
        const exit: CommandExit = {}
        await closer.closeFor(out, exit, em, jobId, reason)
        return { out, exit, em }
    }

    it("closes the parked job of the id with the trimmed reason, says so, and sets no exit code", async () => {
        const { out, exit, em } = await run(JOB, "  old test payment  ", 1)

        expect(em.update.mock.calls[0]?.[2]).toMatchObject({ error: "closed: old test payment" })
        expect(out.write).toHaveBeenCalledWith(`closed ${JOB}\n`)
        expect(exit.exitCode).toBeUndefined()
    })

    it("fails and says so for a job that is not parked", async () => {
        const { out, exit } = await run(JOB, "why", 0)

        expect(out.write).toHaveBeenCalledWith(`not a parked job: ${JOB}\n`)
        expect(exit.exitCode).toBe(1)
    })

    it.each([
        ["an id that is no job id", "not-a-uuid", "why", "not a job id: not-a-uuid\n"],
        ["no id", undefined, "why", "not a job id: \n"],
        ["no reason", JOB, "  ", 'a reason is required: --reason "<why>"\n'],
        ["an absent reason", JOB, undefined, 'a reason is required: --reason "<why>"\n'],
    ])("closes nothing and fails for %s", async (_what, jobId, reason, said) => {
        const { out, exit, em } = await run(jobId, reason, 1)

        expect(em.update).not.toHaveBeenCalled()
        expect(out.write).toHaveBeenCalledWith(said)
        expect(exit.exitCode).toBe(1)
    })
})
