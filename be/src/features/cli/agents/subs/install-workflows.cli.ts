import { CommandRunner, Option, SubCommand } from "nest-commander"
import { AgentWorkflowInstallRunService } from "@modules/domain/agent-graphs"

/** What `install-workflows` reads from its flags. */
export interface InstallWorkflowsOptions {
    /** True makes the missing workflows; absent only reports. */
    readonly execute?: boolean
    /** Only this workspace. */
    readonly workspace?: string
}

@SubCommand({
    name: "install-workflows",
    description:
        "Give every agent the workflows its plugin ships where it holds none (the primary one only where the setup is applied) and report them; --execute makes them (idempotent; never changes a workflow that exists; agrees no right)",
})
/**
 * `cli agents install-workflows [--workspace <id>] [--execute]`: dry by default; hands the flags and stdout to the install run.
 * The process ends non-zero when the install of any agent failed (the others were still done).
 */
export class InstallWorkflowsCli extends CommandRunner {
    constructor(private readonly installs: AgentWorkflowInstallRunService) {
        super()
    }

    /** Runs the install; the run prints the table on stdout. */
    async run(_passedParams: Array<string>, options: InstallWorkflowsOptions = {}): Promise<void> {
        const report = await this.installs.run(process.stdout, {
            execute: options.execute,
            workspaceId: options.workspace,
        })
        if (report.failed > 0) process.exitCode = 1
    }

    /** Make the missing workflows instead of only reporting them. */
    @Option({ flags: "--execute", description: "Make the missing workflows (without it the command only reports)" })
    parseExecute(): boolean {
        return true
    }

    /** Only one workspace. */
    @Option({ flags: "--workspace <id>", description: "Only this workspace (default: every workspace)" })
    parseWorkspace(value: string): string {
        return value
    }
}
