import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsConsoleService } from "@modules/domain/job-ops"
import { RetryFailedJobsCli } from "./retry-failed.cli"

describe("RetryFailedJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [RetryFailedJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(RetryFailedJobsCli)
        const passedParams: Array<string> = ["24hours"]

        await expect(cli.run(passedParams)).resolves.toBeUndefined()

        expect(jobs.requeueFailed).toHaveBeenCalledTimes(1)
        expect(jobs.requeueFailed).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [RetryFailedJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(RetryFailedJobsCli)
        const failure = new Error("job operations unavailable")
        jobs.requeueFailed.mockRejectedValue(failure)

        await expect(cli.run([])).rejects.toBe(failure)

        expect(jobs.requeueFailed).toHaveBeenCalledWith([], process.stdout)
    })
})
