import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob } from "./jobs.contracts"
import { JOB_CLAIMS, JOBS_OPTIONS } from "./jobs.decorators"
import { JobsLogEvent } from "./jobs.log-events"
import type { JobsOptions } from "./jobs.options"
import type { JobClaims } from "./jobs.port"
import { JobRenewalService } from "./job-renewal.service"

const options: JobsOptions = { connection: "primary", workerId: "w-1", leaseMs: 60_000, scheduler: { enabled: false } }
const job: ClaimedJob = { jobId: "j-1", kind: "knowledge.facts", fencingToken: 4, currentStep: "facts", payload: {} }

/** One scheduled beat the test fires by hand. */
interface Beat {
    readonly callback: () => void
    readonly delayMs: number
    cancelled: boolean
    fired: boolean
}

const build = async (leaseMs = 60_000) => {
    const claims = mock<JobClaims>()
    const logger = mock<Logger>()
    const beats: Array<Beat> = []
    const timer = mock<Timer>()
    timer.schedule.mockImplementation((callback, delayMs) => {
        const beat: Beat = { callback, delayMs, cancelled: false, fired: false }
        beats.push(beat)
        return () => {
            beat.cancelled = true
        }
    })
    const fire = async (): Promise<void> => {
        const beat = beats.find((one) => !one.cancelled && !one.fired)
        if (beat !== undefined) beat.fired = true
        beat?.callback()
        await new Promise((resolve) => setImmediate(resolve))
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobRenewalService,
            { provide: JOBS_OPTIONS, useValue: { ...options, leaseMs } },
            { provide: JOB_CLAIMS, useValue: claims },
            { provide: TIMER, useValue: timer },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(JobRenewalService), claims, logger, beats, fire }
}

describe("JobRenewalService keep", () => {
    it("renews the lease under the claim's token every third of a lease until stopped", async () => {
        const { service, claims, beats, fire } = await build()
        claims.renew.mockResolvedValue(undefined)

        const hold = service.keep(job)
        expect(beats[0]?.delayMs).toBe(20_000)
        await fire()
        await fire()

        expect(claims.renew).toHaveBeenCalledTimes(2)
        expect(claims.renew).toHaveBeenCalledWith({ jobId: "j-1", expectedFencingToken: 4, leaseMs: 60_000 })
        hold.stop()
        expect(beats.filter((one) => !one.cancelled && !one.fired)).toEqual([])
    })

    it("stops renewing once a newer worker owns the job: a renewal under a stale token can never work again", async () => {
        const { service, claims, logger, beats, fire } = await build()
        claims.renew.mockRejectedValue(
            new JobsError({ code: JobsErrorCode.FencedOut, params: { jobId: "j-1", token: 4 } }),
        )

        service.keep(job)
        await fire()

        expect(logger.warn).toHaveBeenCalledWith(JobsLogEvent.FencedOut, { jobId: "j-1" })
        expect(beats.filter((one) => !one.cancelled && !one.fired)).toEqual([])
    })

    it("logs a renewal that failed for another reason and tries again at the next beat", async () => {
        const { service, claims, logger, fire } = await build()
        const outage = new Error("connection reset")
        claims.renew.mockRejectedValueOnce(outage).mockResolvedValue(undefined)

        service.keep(job)
        await fire()
        await fire()

        expect(logger.error).toHaveBeenCalledWith(JobsLogEvent.LeaseNotRenewed, outage, { jobId: "j-1" })
        expect(claims.renew).toHaveBeenCalledTimes(2)
    })

    it("never beats faster than once a second, however short the lease", async () => {
        const { service, beats } = await build(900)

        service.keep(job)

        expect(beats[0]?.delayMs).toBe(1000)
    })
})
