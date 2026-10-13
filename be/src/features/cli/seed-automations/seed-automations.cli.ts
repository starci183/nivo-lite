import { Command, CommandRunner } from "nest-commander"
import { RunSeedAutomationsCli } from "./subs/run.cli"

@Command({
    name: "seed-automations",
    description: "The automation catalogue",
    subCommands: [RunSeedAutomationsCli],
})
/** `cli seed-automations`: the catalogue group; its commands are the sub-commands (`cli seed-automations run`). */
export class SeedAutomationsCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
