import { Command, CommandRunner } from "nest-commander"
import { RunSeedWorkspaceCli } from "./subs/run.cli"

@Command({
    name: "seed-workspace",
    description: "The ready-to-use demo workspace",
    subCommands: [RunSeedWorkspaceCli],
})
/** `cli seed-workspace`: the demo workspace group; its commands are the sub-commands (`cli seed-workspace run`). */
export class SeedWorkspaceCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
