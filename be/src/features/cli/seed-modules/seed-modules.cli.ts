import { Command, CommandRunner } from "nest-commander"
import { RunSeedModulesCli } from "./subs/run.cli"

@Command({
    name: "seed-modules",
    description: "Mirror the typed module catalogue into the database",
    subCommands: [RunSeedModulesCli],
})
/** `cli seed-modules`: the catalogue seed group; its commands are the sub-commands (`cli seed-modules run`). */
export class SeedModulesCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
