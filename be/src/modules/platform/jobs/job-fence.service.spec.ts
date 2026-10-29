import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob } from "./jobs.contracts"
import { JOBS_MANAGERS } from "./jobs.decorators"
import { JobFenceService } from "./job-fence.service"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { JobEntity } from "./persistence/entities"

const job: ClaimedJob = {
    jobId: "j-1",
    kind: "mail",
    fencingToken: 3,
    currentStep: "send",
    payload: { id: "m-1" },
}

/** A transaction whose lock builder finds the fence (`found`) or nothing. */
const lockTransaction = (found: boolean) => {
    const lock = fakeQueryBuilder({ getOne: found ? Object.assign(new JobEntity(), { id: "j-1" }) : null })
    const tx = fakeTransaction(mockEntityManager())
    tx.em.createQueryBuilder.mockReturnValue(lock.builder as never)
    return { tx, lock }
}

const build = async (manager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [JobFenceService, { provide: JOBS_MANAGERS, useValue: [manager] }],
    }).compile()
    return { fence: moduleRef.get(JobFenceService) }
}

const buildWithoutConnection = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [JobFenceService, { provide: JOBS_MANAGERS, useValue: [] }],
    }).compile()
    return { fence: moduleRef.get(JobFenceService) }
}

describe("JobFenceService", () => {
    describe("write", () => {
        it("runs the domain write in the transaction that holds the live fence", async () => {
            const { tx, lock } = lockTransaction(true)
            const { fence } = await build(tx.em)
            const action = jest.fn().mockResolvedValue(undefined)

            await fence.write(job, action)

            expect(action).toHaveBeenCalledTimes(1)
            expect(tx.em.createQueryBuilder).toHaveBeenCalledWith(JobEntity, "job")
            expect(lock.callsOf("where")).toEqual([
                [
                    "job.id = :jobId AND job.fencingToken = :token AND job.status = :running",
                    { jobId: "j-1", token: 3, running: "running" },
                ],
            ])
            expect(lock.callsOf("setLock")).toEqual([["pessimistic_write"]])
            expect(tx.commits).toBe(1)
        })

        it("refuses a stale token before the domain write and rolls the transaction back", async () => {
            const { tx } = lockTransaction(false)
            const { fence } = await build(tx.em)
            const action = jest.fn().mockResolvedValue(undefined)

            await expect(fence.write(job, action)).rejects.toMatchObject({
                name: "JobsError",
                code: JobsErrorCode.FencedOut,
                params: { jobId: "j-1", token: 3 },
            })

            expect(action).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })

        it("rolls the fence back when the domain write fails", async () => {
            const { tx } = lockTransaction(true)
            const { fence } = await build(tx.em)
            const failure = new Error("the change failed")

            await expect(fence.write(job, () => Promise.reject(failure))).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
        })

        it("refuses to write when the capability has no connection", async () => {
            const { fence } = await buildWithoutConnection()
            const attempt = fence.write(job, () => Promise.resolve())

            await expect(attempt).rejects.toBeInstanceOf(JobsError)
            await expect(attempt).rejects.toMatchObject({ code: JobsErrorCode.ConnectionMissing })
        })
    })
})
