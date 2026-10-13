import { Command, CommandRunner } from "nest-commander"
import { RunSeedKnowledgeCli } from "./subs/run.cli"

@Command({
    name: "seed-knowledge",
    description: "Publish the base knowledge of NIVO",
    subCommands: [RunSeedKnowledgeCli],
})
/** `cli seed-knowledge`: the base knowledge seed group; its commands are the sub-commands (`cli seed-knowledge run`). */
export class SeedKnowledgeCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
