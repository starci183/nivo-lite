import { Command, CommandRunner } from "nest-commander"
import { ReseedToolsCli } from "./subs/reseed.cli"

@Command({
    name: "tools",
    description: "Operate the tool ids stored in the workspaces (the three-level rename of 2026-11-12: nivo.tool.*)",
    subCommands: [ReseedToolsCli],
})
/** `cli tools`: the group; its command is the sub-command `reseed`. */
export class ToolsCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
