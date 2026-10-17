import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsConsoleService } from "@modules/domain/job-ops"
import { RetryJobsCli } from "./retry.cli"

describe("RetryJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [RetryJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(RetryJobsCli)
        const passedParams: Array<string> = ["not-a-uuid"]

        await expect(cli.run(passedParams)).resolves.toBeUndefined()

        expect(jobs.requeue).toHaveBeenCalledTimes(1)
        expect(jobs.requeue).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [RetryJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(RetryJobsCli)
        const failure = new Error("job operations unavailable")
        jobs.requeue.mockRejectedValue(failure)

        await expect(cli.run([])).rejects.toBe(failure)

        expect(jobs.requeue).toHaveBeenCalledWith([], process.stdout)
    })
})
