import { Test } from "@nestjs/testing"
import { Not } from "typeorm"
import {
    builder,
    fakeTransaction,
    mock,
    mockEntityManager,
    queueQueryBuilders,
    recordingQueueOutbox,
} from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { JobsErrorCode } from "./errors/jobs.error"
import { JOBS_MANAGERS, JOBS_OPTIONS } from "./jobs.decorators"
import { JobsLogEvent } from "./jobs.log-events"
import type { JobsOptions } from "./jobs.options"
import { ParkedJobResumerService } from "./parked-job-resumer.service"
import { JobEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const ENQUEUE_SQL = 'SELECT * FROM "public"."job_enqueue"($1, $2, $3, $4, $5)'

const parkedJob = (id: string, payload: object, extra: Partial<JobEntity> = {}): JobEntity =>
    Object.assign(new JobEntity(), {
        id,
        kind: "module-jobs.run",
        jobKey: `key-${id}`,
        status: "failed_awaiting_fix",
        queue: "module_jobs",
        resumeCount: 1,
        payload,
        ...extra,
    })

const build = async (em: MockEntityManager, buildId?: string) => {
    const logger = mock<Logger>()
    const outbox = recordingQueueOutbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ParkedJobResumerService,
            { provide: JOBS_MANAGERS, useValue: [em] },
            {
                provide: JOBS_OPTIONS,
                useValue: builder<JobsOptions>({
                    connection: "primary",
                    workerId: "w-1",
                    leaseMs: 60000,
                    scheduler: { enabled: false },
                })(buildId === undefined ? {} : { buildId }),
            },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { resumer: moduleRef.get(ParkedJobResumerService), logger, outbox }
}

describe("ParkedJobResumerService resume", () => {
    it("hands every parked job back to its queue under the next resume key and gives the row the new delivery's key", async () => {
        const em = mockEntityManager({
            find: [JobEntity, [parkedJob("j-1", {}), parkedJob("j-2", {})]],
            update: [JobEntity, {}],
            query: [
                [ENQUEUE_SQL, [{ job_enqueue: "d-1" }]],
                [ENQUEUE_SQL, [{ job_enqueue: "d-2" }]],
            ],
        })
        const transaction = fakeTransaction(em)
        queueQueryBuilders(em, [
            { getOne: parkedJob("j-1", { workspaceId: WS, job: "sales.notice" }) },
            { getOne: parkedJob("j-2", {}) },
        ])
        const { resumer, logger } = await build(em)

        await expect(resumer.resumeAll()).resolves.toBe(2)

        expect(em.query.mock.calls).toEqual([
            [
                ENQUEUE_SQL,
                [
                    WS,
                    "module_jobs",
                    "module-jobs.run",
                    JSON.stringify({ workspaceId: WS, job: "sales.notice" }),
                    "key-j-1:r2",
                ],
            ],
            [ENQUEUE_SQL, [null, "module_jobs", "module-jobs.run", "{}", "key-j-2:r2"]],
        ])
        expect(em.update).toHaveBeenNthCalledWith(
            1,
            JobEntity,
            { id: "j-1" },
            {
                jobKey: "d-1",
                status: "failed",
                resumeCount: 2,
                failureClass: null,
                parkedBuild: null,
                parkedAt: null,
                alertedAt: null,
                error: null,
            },
        )
        expect(em.update).toHaveBeenNthCalledWith(
            2,
            JobEntity,
            { id: "j-2" },
            expect.objectContaining({ jobKey: "d-2" }),
        )
        expect(transaction.outcomes).toEqual(["commit", "commit"])
        expect(logger.info).toHaveBeenCalledWith(JobsLogEvent.Resumed, { jobId: "j-1", resumeCount: 2 })
    })
})

describe("ParkedJobResumerService resume one", () => {
    it("hands back one job by id and nothing for an id that is not parked", async () => {
        const em = mockEntityManager({ find: [JobEntity, []] })
        const { resumer } = await build(em)

        await expect(resumer.resume("j-9")).resolves.toBe(0)
        expect(em.find).toHaveBeenCalledWith(JobEntity, {
            select: { id: true },
            where: { id: "j-9", status: "failed_awaiting_fix" },
            order: { parkedAt: "ASC" },
            take: 100,
        })
    })

    it.each([
        ["another replica holds the lock", null],
        ["the job has no queue to go back to", parkedJob("j-1", {}, { queue: null })],
    ])("leaves the job alone when %s", async (_why, locked) => {
        const em = mockEntityManager({ find: [JobEntity, [parkedJob("j-1", {})]] })
        fakeTransaction(em)
        queueQueryBuilders(em, [{ getOne: locked }])
        const { resumer } = await build(em)

        await expect(resumer.resume("j-1")).resolves.toBe(0)
        expect(em.query).not.toHaveBeenCalled()
    })

    it("rolls back when the outbox answers no delivery", async () => {
        const em = mockEntityManager({ find: [JobEntity, [parkedJob("j-1", {})]], query: [ENQUEUE_SQL, []] })
        const transaction = fakeTransaction(em)
        queueQueryBuilders(em, [{ getOne: parkedJob("j-1", {}) }])
        const { resumer } = await build(em)

        await expect(resumer.resume("j-1")).rejects.toMatchObject({
            code: JobsErrorCode.ResumeNotQueued,
            params: { jobId: "j-1" },
        })
        expect(transaction.outcomes).toEqual(["rollback"])
    })
})

describe("ParkedJobResumerService without a connection", () => {
    it("refuses to run with no connection to the job table", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                ParkedJobResumerService,
                { provide: JOBS_MANAGERS, useValue: [] },
                {
                    provide: JOBS_OPTIONS,
                    useValue: builder<JobsOptions>({
                        connection: "primary",
                        workerId: "w-1",
                        leaseMs: 60000,
                        scheduler: { enabled: false },
                    })(),
                },
                { provide: QUEUE_OUTBOX, useValue: recordingQueueOutbox() },
                { provide: LOGGER, useValue: mock<Logger>() },
            ],
        }).compile()

        await expect(moduleRef.get(ParkedJobResumerService).resumeAll()).rejects.toMatchObject({
            code: JobsErrorCode.ConnectionMissing,
        })
    })
})

describe("ParkedJobResumerService boot and sweep", () => {
    it("asks for the jobs parked under another build to be handed back, once per build, when this build is named", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        const { resumer, outbox } = await build(em, "build-2")

        await resumer.onApplicationBootstrap()

        expect(outbox.jobs).toEqual([{ queue: "parked_jobs_sweep", payload: { build: "build-2" } }])
        expect(outbox.allInTransaction).toBe(true)
    })

    it("asks for nothing at boot when the build is not named", async () => {
        const em = mockEntityManager()
        const { resumer, outbox } = await build(em)

        await resumer.onApplicationBootstrap()

        expect(outbox.jobs).toEqual([])
    })

    it("hands back the jobs parked under any other build when the sweep names one", async () => {
        const em = mockEntityManager({ find: [JobEntity, []] })
        const { resumer } = await build(em)

        await expect(resumer.sweep({ build: "build-2" })).resolves.toBe(0)
        expect(em.find).toHaveBeenCalledWith(JobEntity, {
            select: { id: true },
            where: { parkedBuild: Not("build-2"), status: "failed_awaiting_fix" },
            order: { parkedAt: "ASC" },
            take: 100,
        })
    })

    it("hands back every parked job when the sweep names no build", async () => {
        const em = mockEntityManager({ find: [JobEntity, []] })
        const { resumer } = await build(em)

        await expect(resumer.sweep({})).resolves.toBe(0)
        expect(em.find).toHaveBeenCalledWith(JobEntity, {
            select: { id: true },
            where: { status: "failed_awaiting_fix" },
            order: { parkedAt: "ASC" },
            take: 100,
        })
    })
})
