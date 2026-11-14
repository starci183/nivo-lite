import { Command, CommandRunner } from "nest-commander"
import { PlanAccountDataCli } from "./subs/plan.cli"

@Command({
    name: "account-data",
    description: "Operate the provider data every account (connection) keeps in account_data",
    subCommands: [PlanAccountDataCli],
})
/** `cli account-data`: the group; its command is the sub-command `plan`. */
export class AccountDataCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
