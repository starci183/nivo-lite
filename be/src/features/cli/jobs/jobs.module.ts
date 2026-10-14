import { Module } from "@nestjs/common"
import { JobsCli } from "./jobs.cli"
import { FailedJobsCli } from "./subs/failed.cli"
import { OpenJobsCli } from "./subs/open.cli"
import { RetryJobsCli } from "./subs/retry.cli"
import { RetryFailedJobsCli } from "./subs/retry-failed.cli"
import { StatsJobsCli } from "./subs/stats.cli"
import { WatchdogJobsCli } from "./subs/watchdog.cli"

@Module({
    providers: [JobsCli, StatsJobsCli, FailedJobsCli, OpenJobsCli, RetryJobsCli, RetryFailedJobsCli, WatchdogJobsCli],
})
/** The jobs group and its six commands over the job operations capability. */
export class JobsModule {}
