import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsConsoleService } from "@modules/domain/job-ops"
import { StatsJobsCli } from "./stats.cli"

describe("StatsJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [StatsJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(StatsJobsCli)
        const passedParams: Array<string> = []

        await expect(cli.run(passedParams)).resolves.toBeUndefined()

        expect(jobs.stats).toHaveBeenCalledTimes(1)
        expect(jobs.stats).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [StatsJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(StatsJobsCli)
        const failure = new Error("job operations unavailable")
        jobs.stats.mockRejectedValue(failure)

        await expect(cli.run([])).rejects.toBe(failure)

        expect(jobs.stats).toHaveBeenCalledWith([], process.stdout)
    })
})
