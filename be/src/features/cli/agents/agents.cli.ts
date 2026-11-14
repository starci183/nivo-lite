import { Command, CommandRunner } from "nest-commander"
import { InstallWorkflowsCli } from "./subs/install-workflows.cli"

@Command({
    name: "agents",
    description: "Operate the agents of the workspaces (the workflows their plugins ship)",
    subCommands: [InstallWorkflowsCli],
})
/** `cli agents`: the group; its command is the sub-command `install-workflows`. */
export class AgentsCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
