import { mock } from "@starci/jest-preset"
import type { JobOpsConsoleService } from "@modules/domain/job-ops"
import { OpenJobsCli } from "./open.cli"

describe("OpenJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const passedParams: Array<string> = ["200"]

        await expect(new OpenJobsCli(jobs).run(passedParams)).resolves.toBeUndefined()

        expect(jobs.open).toHaveBeenCalledTimes(1)
        expect(jobs.open).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const failure = new Error("job operations unavailable")
        jobs.open.mockRejectedValue(failure)

        await expect(new OpenJobsCli(jobs).run([])).rejects.toBe(failure)

        expect(jobs.open).toHaveBeenCalledWith([], process.stdout)
    })
})
