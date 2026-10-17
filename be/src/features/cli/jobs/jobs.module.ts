import { Module } from "@nestjs/common"
import { JobsCli } from "./jobs.cli"
import { ConfigurableModuleClass } from "./jobs.module-definition"
import { FailedJobsCli } from "./subs/failed.cli"
import { OpenJobsCli } from "./subs/open.cli"
import { RetryJobsCli } from "./subs/retry.cli"
import { RetryFailedJobsCli } from "./subs/retry-failed.cli"
import { StatsJobsCli } from "./subs/stats.cli"
import { TickJobsCli } from "./subs/tick.cli"
import { WatchdogJobsCli } from "./subs/watchdog.cli"

@Module({
    providers: [
        JobsCli,
        StatsJobsCli,
        FailedJobsCli,
        OpenJobsCli,
        RetryJobsCli,
        RetryFailedJobsCli,
        WatchdogJobsCli,
        TickJobsCli,
    ],
})
/** The jobs group and its seven commands over the job operations capability. */
export class CliJobsModule extends ConfigurableModuleClass {}
