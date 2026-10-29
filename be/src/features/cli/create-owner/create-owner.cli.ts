import { Command, CommandRunner } from "nest-commander"
import { RunCreateOwnerCli } from "./subs/run.cli"

@Command({
    name: "create-owner",
    description: "Create the first account of a clean database",
    subCommands: [RunCreateOwnerCli],
})
/** `cli create-owner`: the group; its command is the sub-command (`cli create-owner run`). */
export class CreateOwnerCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
