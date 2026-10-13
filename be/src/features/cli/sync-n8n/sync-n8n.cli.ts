import { Command, CommandRunner } from "nest-commander"
import { RunSyncN8nCli } from "./subs/run.cli"

@Command({
    name: "sync-n8n",
    description: "The shared n8n workflows",
    subCommands: [RunSyncN8nCli],
})
/** `cli sync-n8n`: the workflow group; its commands are the sub-commands (`cli sync-n8n run`). */
export class SyncN8nCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
