import { Command, CommandRunner } from "nest-commander"
import { RunCleanupWorkspacesCli } from "./subs/run.cli"

@Command({
    name: "cleanup-workspaces",
    description: "Clean a database down to the kept workspaces, from a reviewed dry-run receipt",
    subCommands: [RunCleanupWorkspacesCli],
})
/** `cli cleanup-workspaces`: the cleanup group; its command is the sub-command (`cli cleanup-workspaces run`). */
export class CleanupWorkspacesCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
