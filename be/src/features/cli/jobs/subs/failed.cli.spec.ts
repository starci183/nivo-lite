import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsConsoleService } from "@modules/domain/job-ops"
import { FailedJobsCli } from "./failed.cli"

describe("FailedJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [FailedJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(FailedJobsCli)
        const passedParams: Array<string> = ["20jobs"]

        await expect(cli.run(passedParams)).resolves.toBeUndefined()

        expect(jobs.failed).toHaveBeenCalledTimes(1)
        expect(jobs.failed).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [FailedJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(FailedJobsCli)
        const failure = new Error("job operations unavailable")
        jobs.failed.mockRejectedValue(failure)

        await expect(cli.run([])).rejects.toBe(failure)

        expect(jobs.failed).toHaveBeenCalledWith([], process.stdout)
    })
})
