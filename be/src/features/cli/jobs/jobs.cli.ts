import { Command, CommandRunner } from "nest-commander"
import { CloseJobsCli } from "./subs/close.cli"
import { FailedJobsCli } from "./subs/failed.cli"
import { OpenJobsCli } from "./subs/open.cli"
import { RetryJobsCli } from "./subs/retry.cli"
import { RetryFailedJobsCli } from "./subs/retry-failed.cli"
import { StatsJobsCli } from "./subs/stats.cli"
import { TickJobsCli } from "./subs/tick.cli"
import { WatchdogJobsCli } from "./subs/watchdog.cli"

@Command({
    name: "jobs",
    description: "Inspect, retry and close background jobs through the back end",
    subCommands: [
        StatsJobsCli,
        FailedJobsCli,
        OpenJobsCli,
        RetryJobsCli,
        RetryFailedJobsCli,
        WatchdogJobsCli,
        TickJobsCli,
        CloseJobsCli,
    ],
})
/** `cli jobs`: the operator commands for background jobs. */
export class JobsCli extends CommandRunner {
    /** Shows the group help when no sub-command is named. */
    run(): Promise<void> {
        return this.command.help()
    }
}
