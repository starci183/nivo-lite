import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsConsoleService } from "@modules/domain/job-ops"
import { OpenJobsCli } from "./open.cli"

describe("OpenJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [OpenJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(OpenJobsCli)
        const passedParams: Array<string> = ["200"]

        await expect(cli.run(passedParams)).resolves.toBeUndefined()

        expect(jobs.open).toHaveBeenCalledTimes(1)
        expect(jobs.open).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [OpenJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(OpenJobsCli)
        const failure = new Error("job operations unavailable")
        jobs.open.mockRejectedValue(failure)

        await expect(cli.run([])).rejects.toBe(failure)

        expect(jobs.open).toHaveBeenCalledWith([], process.stdout)
    })
})
