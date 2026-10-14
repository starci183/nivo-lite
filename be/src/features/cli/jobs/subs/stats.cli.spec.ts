import { mock } from "@starci/jest-preset"
import type { JobOpsConsoleService } from "@modules/domain/job-ops"
import { StatsJobsCli } from "./stats.cli"

describe("StatsJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const passedParams: Array<string> = []

        await expect(new StatsJobsCli(jobs).run(passedParams)).resolves.toBeUndefined()

        expect(jobs.stats).toHaveBeenCalledTimes(1)
        expect(jobs.stats).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const failure = new Error("job operations unavailable")
        jobs.stats.mockRejectedValue(failure)

        await expect(new StatsJobsCli(jobs).run([])).rejects.toBe(failure)

        expect(jobs.stats).toHaveBeenCalledWith([], process.stdout)
    })
})
