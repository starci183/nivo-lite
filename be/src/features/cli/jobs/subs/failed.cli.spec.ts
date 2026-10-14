import { mock } from "@starci/jest-preset"
import type { JobOpsConsoleService } from "@modules/domain/job-ops"
import { FailedJobsCli } from "./failed.cli"

describe("FailedJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const passedParams: Array<string> = ["20jobs"]

        await expect(new FailedJobsCli(jobs).run(passedParams)).resolves.toBeUndefined()

        expect(jobs.failed).toHaveBeenCalledTimes(1)
        expect(jobs.failed).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const failure = new Error("job operations unavailable")
        jobs.failed.mockRejectedValue(failure)

        await expect(new FailedJobsCli(jobs).run([])).rejects.toBe(failure)

        expect(jobs.failed).toHaveBeenCalledWith([], process.stdout)
    })
})
