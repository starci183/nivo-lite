import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsConsoleService } from "@modules/domain/job-ops"
import { WatchdogJobsCli } from "./watchdog.cli"

describe("WatchdogJobsCli", () => {
    it("hands positional arguments and output unchanged to the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [WatchdogJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(WatchdogJobsCli)
        const passedParams: Array<string> = []

        await expect(cli.run(passedParams)).resolves.toBeUndefined()

        expect(jobs.watchdog).toHaveBeenCalledTimes(1)
        expect(jobs.watchdog).toHaveBeenCalledWith(passedParams, process.stdout)
    })

    it("propagates capability failures", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({
            providers: [WatchdogJobsCli, { provide: JobOpsConsoleService, useValue: jobs }],
        }).compile()
        const cli = moduleRef.get(WatchdogJobsCli)
        const failure = new Error("job operations unavailable")
        jobs.watchdog.mockRejectedValue(failure)

        await expect(cli.run([])).rejects.toBe(failure)

        expect(jobs.watchdog).toHaveBeenCalledWith([], process.stdout)
    })
})
