import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsConsoleService } from "./job-ops-console.service"
import type { JobOpsConsoleOutput } from "./job-ops.contracts"
import { JobOpsService } from "./job-ops.service"

const OUTBOX_ID = "12345678-1234-1234-1234-123456789abc"
const NUMERIC_OPERATIONS = [
    { operation: "failed", fallback: 20, maximum: 200 },
    { operation: "open", fallback: 20, maximum: 200 },
    { operation: "requeueFailed", fallback: 24, maximum: 720 },
] as const
const MALFORMED_NUMBERS = [
    "",
    " ",
    " 20",
    "20 ",
    "20\n",
    "20\r\n",
    "\n20",
    "\r\n20",
    "20\t",
    "1.5",
    "20x",
    "0x14",
    "1e2",
    "+20",
    "-1",
    "Infinity",
    "NaN",
]

const build = async () => {
    const jobs = mock<JobOpsService>()
    jobs.stats.mockResolvedValue(null)
    jobs.failed.mockResolvedValue([])
    jobs.open.mockResolvedValue([])
    jobs.requeue.mockResolvedValue(null)
    jobs.requeueFailed.mockResolvedValue({ requeued: 0, failed: 0 })
    jobs.watchdog.mockResolvedValue({ failed24h: -1, oldestQueuedAgeSeconds: -1 })
    const output = mock<JobOpsConsoleOutput>()
    const moduleRef = await Test.createTestingModule({
        providers: [JobOpsConsoleService, { provide: JobOpsService, useValue: jobs }],
    }).compile()
    return { jobs, output, service: moduleRef.get(JobOpsConsoleService) }
}

describe("JobOpsConsoleService", () => {
    describe("stats", () => {
        it("prints the complete statistics as pretty JSON and ignores positional arguments", async () => {
            const { jobs, output, service } = await build()
            jobs.stats.mockResolvedValue({
                queues: { knowledge: { depth: 4, oldestAgeSeconds: 12, total: 50 } },
                running: 2,
                failed24h: 3,
                oldestQueuedAgeSeconds: 600,
                checkedAt: "2026-10-14T00:00:00.000Z",
            })

            await expect(service.stats(["ignored"], output)).resolves.toBeUndefined()

            expect(jobs.stats).toHaveBeenCalledWith()
            expect(jobs.stats).toHaveBeenCalledTimes(1)
            expect(output.write.mock.calls).toEqual([
                [
                    `{\n  "queues": {\n    "knowledge": {\n      "depth": 4,\n      "oldestAgeSeconds": 12,\n      "total": 50\n    }\n  },\n  "running": 2,\n  "failed24h": 3,\n  "oldestQueuedAgeSeconds": 600,\n  "checkedAt": "2026-10-14T00:00:00.000Z"\n}\n`,
                ],
            ])
        })

        it("prints null statistics with the terminal newline", async () => {
            const { output, service } = await build()

            await service.stats([], output)

            expect(output.write.mock.calls).toEqual([["null\n"]])
        })
    })

    describe.each(NUMERIC_OPERATIONS)("$operation arguments", ({ operation, fallback, maximum }) => {
        it("uses the default only when the argument is omitted", async () => {
            const { jobs, output, service } = await build()

            await expect(service[operation]([], output)).resolves.toBeUndefined()

            expect(jobs[operation]).toHaveBeenCalledWith(fallback)
            expect(jobs[operation]).toHaveBeenCalledTimes(1)
        })

        it.each(["20", "0020"])("parses decimal digits %j and ignores later arguments", async (argument) => {
            const { jobs, output, service } = await build()

            await service[operation]([argument, "ignored"], output)

            expect(jobs[operation]).toHaveBeenCalledWith(20)
            expect(jobs[operation]).toHaveBeenCalledTimes(1)
        })

        it.each([0, 1, maximum, maximum + 1])("delegates numeric bounds for %s to the domain", async (value) => {
            const { jobs, output, service } = await build()

            await service[operation]([String(value)], output)

            expect(jobs[operation]).toHaveBeenCalledWith(value)
            expect(jobs[operation]).toHaveBeenCalledTimes(1)
        })

        it.each(MALFORMED_NUMBERS)(
            "delegates malformed argument %j as NaN without replacing it with the default",
            async (argument) => {
                const { jobs, output, service } = await build()
                const cause = new Error("invalid domain input")
                jobs[operation].mockRejectedValue(cause)

                await expect(service[operation]([argument], output)).rejects.toBe(cause)

                expect(jobs[operation]).toHaveBeenCalledWith(Number.NaN)
                expect(jobs[operation]).toHaveBeenCalledTimes(1)
                expect(output.write).not.toHaveBeenCalled()
            },
        )

        it("delegates an overflowing digit-only number to domain validation", async () => {
            const { jobs, output, service } = await build()
            const cause = new Error("invalid domain input")
            jobs[operation].mockRejectedValue(cause)

            await expect(service[operation](["9".repeat(400)], output)).rejects.toBe(cause)

            expect(jobs[operation]).toHaveBeenCalledWith(Number.POSITIVE_INFINITY)
            expect(output.write).not.toHaveBeenCalled()
        })
    })

    describe("failed", () => {
        it("prints every safe column in the script order, preserving zero and blanking nulls", async () => {
            const { jobs, output, service } = await build()
            jobs.failed.mockResolvedValue([
                {
                    last_error: "failure | details",
                    finished_at: "2026-10-14T00:00:00.000Z",
                    attempts: 3,
                    name: "alpha",
                    id: OUTBOX_ID,
                },
                { last_error: null, finished_at: null, attempts: 0, name: "beta", id: "second" },
            ])

            await service.failed([], output)

            expect(output.write.mock.calls).toEqual([
                [`${OUTBOX_ID} | alpha | 3 | 2026-10-14T00:00:00.000Z | failure | details\n`],
                ["second | beta | 0 |  | \n"],
            ])
        })

        it("prints nothing for an empty result", async () => {
            const { output, service } = await build()

            await service.failed([], output)

            expect(output.write).not.toHaveBeenCalled()
        })
    })

    describe("open", () => {
        it("prints queued and running rows in the script column order and blanks null errors", async () => {
            const { jobs, output, service } = await build()
            jobs.open.mockResolvedValue([
                {
                    last_error: "previous error",
                    created_at: "2026-10-14T00:00:00.000Z",
                    attempts: 2,
                    state: "running",
                    name: "alpha",
                    id: OUTBOX_ID,
                },
                {
                    last_error: null,
                    created_at: "2026-10-14T01:00:00.000Z",
                    attempts: 0,
                    state: "queued",
                    name: "beta",
                    id: "second",
                },
            ])

            await service.open([], output)

            expect(output.write.mock.calls).toEqual([
                [`${OUTBOX_ID} | alpha | running | 2 | 2026-10-14T00:00:00.000Z | previous error\n`],
                ["second | beta | queued | 0 | 2026-10-14T01:00:00.000Z | \n"],
            ])
        })

        it("prints nothing for an empty result", async () => {
            const { output, service } = await build()

            await service.open([], output)

            expect(output.write).not.toHaveBeenCalled()
        })
    })

    describe("requeue", () => {
        it("prints the lossless bigint message id and ignores later arguments", async () => {
            const { jobs, output, service } = await build()
            jobs.requeue.mockResolvedValue("9223372036854775807")

            await expect(service.requeue([OUTBOX_ID, "ignored"], output)).resolves.toBeUndefined()

            expect(jobs.requeue).toHaveBeenCalledWith(OUTBOX_ID)
            expect(jobs.requeue).toHaveBeenCalledTimes(1)
            expect(output.write.mock.calls).toEqual([["requeued as message 9223372036854775807\n"]])
        })

        it("prints the not-failed result for a null message id", async () => {
            const { output, service } = await build()

            await service.requeue([OUTBOX_ID], output)

            expect(output.write.mock.calls).toEqual([["not a failed job\n"]])
        })

        it.each([
            { parameters: [] },
            { parameters: [""] },
            { parameters: ["not-a-uuid"] },
            { parameters: [`${OUTBOX_ID}\r\n`] },
        ])("delegates missing or malformed id %j unchanged", async ({ parameters }) => {
            const { jobs, output, service } = await build()
            const cause = new Error("invalid outbox id")
            jobs.requeue.mockRejectedValue(cause)

            await expect(service.requeue(parameters, output)).rejects.toBe(cause)

            expect(jobs.requeue).toHaveBeenCalledWith(parameters[0] ?? "")
            expect(output.write).not.toHaveBeenCalled()
        })
    })

    describe("requeueFailed", () => {
        it.each([
            { requeued: 2, failed: 5 },
            { requeued: 0, failed: 0 },
        ])("prints the requeued and eligible counts for %j", async (result) => {
            const { jobs, output, service } = await build()
            jobs.requeueFailed.mockResolvedValue(result)

            await service.requeueFailed([], output)

            expect(output.write.mock.calls).toEqual([[`requeued ${result.requeued} of ${result.failed}\n`]])
        })
    })

    describe("watchdog", () => {
        it.each([
            { failed24h: 3, oldestQueuedAgeSeconds: 600 },
            { failed24h: 0, oldestQueuedAgeSeconds: 0 },
            { failed24h: -1, oldestQueuedAgeSeconds: -1 },
        ])("prints exactly the two counters for %j and ignores positional arguments", async (result) => {
            const { jobs, output, service } = await build()
            jobs.watchdog.mockResolvedValue(result)

            await expect(service.watchdog(["ignored"], output)).resolves.toBeUndefined()

            expect(jobs.watchdog).toHaveBeenCalledWith()
            expect(jobs.watchdog).toHaveBeenCalledTimes(1)
            expect(output.write.mock.calls).toEqual([[`${result.failed24h} ${result.oldestQueuedAgeSeconds}\n`]])
        })
    })

    it.each(["stats", "failed", "open", "requeue", "requeueFailed", "watchdog"] as const)(
        "propagates a %s operation error without printing a result",
        async (operation) => {
            const { jobs, output, service } = await build()
            const cause = new Error("jobs unavailable")
            jobs[operation].mockRejectedValue(cause)

            await expect(service[operation]([OUTBOX_ID], output)).rejects.toBe(cause)

            expect(jobs[operation]).toHaveBeenCalledTimes(1)
            expect(output.write).not.toHaveBeenCalled()
        },
    )
})
