import { Command, CommandRunner } from "nest-commander"
import { RunPruneWorkspacesCli } from "./subs/run.cli"

@Command({
    name: "prune-workspaces",
    description: "Delete the workspaces that are not kept",
    subCommands: [RunPruneWorkspacesCli],
})
/** `cli prune-workspaces`: the prune group; its commands are the sub-commands (`cli prune-workspaces run`). */
export class PruneWorkspacesCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
