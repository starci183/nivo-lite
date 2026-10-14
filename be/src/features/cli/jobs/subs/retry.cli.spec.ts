import { mock } from "@starci/jest-preset"
import type { JobOpsConsoleService } from "@modules/domain/job-ops"
import { RetryJobsCli } from "./retry.cli"

describe("RetryJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const passedParams: Array<string> = ["not-a-uuid"]

        await expect(new RetryJobsCli(jobs).run(passedParams)).resolves.toBeUndefined()

        expect(jobs.requeue).toHaveBeenCalledTimes(1)
        expect(jobs.requeue).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const failure = new Error("job operations unavailable")
        jobs.requeue.mockRejectedValue(failure)

        await expect(new RetryJobsCli(jobs).run([])).rejects.toBe(failure)

        expect(jobs.requeue).toHaveBeenCalledWith([], process.stdout)
    })
})
