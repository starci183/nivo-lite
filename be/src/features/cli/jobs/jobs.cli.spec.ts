import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ParkedJobCloseService } from "@modules/platform/jobs"
import { JobOpsConsoleService, JobOpsTickService } from "@modules/domain/job-ops"
import { JobsCli } from "./jobs.cli"
import { CloseJobsCli } from "./subs/close.cli"
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

    it("constructs the group and all eight commands with their explicit capabilities", async () => {
        const jobs = mock<JobOpsConsoleService>()
        const ticks = mock<JobOpsTickService>()
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
                CloseJobsCli,
                { provide: ParkedJobCloseService, useValue: mock<ParkedJobCloseService>() },
                { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager({}) },
                { provide: JobOpsConsoleService, useValue: jobs },
                { provide: JobOpsTickService, useValue: ticks },
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
            CloseJobsCli,
        ]) {
            expect(moduleRef.get(command)).toBeInstanceOf(command)
        }
    })
})
