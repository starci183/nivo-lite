import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsConsoleService } from "@modules/domain/job-ops"
import { JobsCli } from "./jobs.cli"
import { JobsModule } from "./jobs.module"
import { FailedJobsCli } from "./subs/failed.cli"
import { OpenJobsCli } from "./subs/open.cli"
import { RetryJobsCli } from "./subs/retry.cli"
import { RetryFailedJobsCli } from "./subs/retry-failed.cli"
import { StatsJobsCli } from "./subs/stats.cli"
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

    it("makes the group and all six commands available with the console capability", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const moduleRef = await Test.createTestingModule({ imports: [JobsModule] })
            .useMocker((provider) => (provider === JobOpsConsoleService ? jobs : undefined))
            .compile()

        for (const command of [
            JobsCli,
            StatsJobsCli,
            FailedJobsCli,
            OpenJobsCli,
            RetryJobsCli,
            RetryFailedJobsCli,
            WatchdogJobsCli,
        ]) {
            expect(moduleRef.get(command)).toBeInstanceOf(command)
        }
    })
})
