import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsConsoleService, JobTickService } from "@modules/domain/job-ops"
import { JobsCli } from "./jobs.cli"
import { FailedJobsCli } from "./subs/failed.cli"
import { OpenJobsCli } from "./subs/open.cli"
import { RetryJobsCli } from "./subs/retry.cli"
import { RetryFailedJobsCli } from "./subs/retry-failed.cli"
import { StatsJobsCli } from "./subs/stats.cli"
import { TickJobsCli } from "./subs/tick.cli"
import { WatchdogJobsCli } from "./subs/watchdog.cli"

describe("JobsCli", () => {
    it("shows the group help when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [JobsCli] }).compile()
        const group = moduleRef.get(JobsCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })

    it("constructs the group and all seven commands with their explicit capabilities", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const ticks = mock<JobTickService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                JobsCli,
                StatsJobsCli,
                FailedJobsCli,
                OpenJobsCli,
                RetryJobsCli,
                RetryFailedJobsCli,
                WatchdogJobsCli,
                TickJobsCli,
                { provide: JobOpsConsoleService, useValue: jobs },
                { provide: JobTickService, useValue: ticks },
            ],
        }).compile()

        for (const command of [
            JobsCli,
            StatsJobsCli,
            FailedJobsCli,
            OpenJobsCli,
            RetryJobsCli,
            RetryFailedJobsCli,
            WatchdogJobsCli,
            TickJobsCli,
        ]) {
            expect(moduleRef.get(command)).toBeInstanceOf(command)
        }
    })
})
