import { readFile, readdir } from "node:fs/promises"
import { Command, CommandRunner, Option } from "nest-commander"
import { WorkflowResetCommandService, type ResetWorkflowsCommand } from "@modules/domain/workspace-seed"

/** The folder of the seeded graphs, relative to the lane root the command runs in. */
const DEFAULT_GRAPHS = ".starcistacks/dev/seeds/data/graphs"

@Command({
    name: "reset-workflows",
    description:
        "Replace the workflows of the Chatbot, Sales and Accounting agents of a workspace with the seeded graphs, clearing their runs and the lead memory",
})
/**
 * `cli reset-workflows --workspace <name> [--graphs <folder>] [--dry-run]`: the workflow-only reset (`--dry-run` prints the counts per
 * kind and changes nothing). It hands the options and the file readers to the reset command, which reads the folder's graphs and runs
 * the reset. Idempotent.
 */
export class ResetWorkflowsCli extends CommandRunner {
    constructor(private readonly commands: WorkflowResetCommandService) {
        super()
    }

    /** Runs the reset over the graphs of the folder. */
    run(_params: Array<string>, options: ResetWorkflowsCommand): Promise<void> {
        return this.commands.run(options, { readdir, readFile })
    }

    /** The workspace name; none given is the empty name, which the reset refuses. */
    @Option({ flags: "-w, --workspace <name>", description: "The name of the workspace to reset", defaultValue: "" })
    parseWorkspace(value: string): string {
        return value
    }

    /** Count only: print what the reset would clear, per kind, and change nothing. */
    @Option({ flags: "--dry-run", description: "Print what the reset would clear, per kind, and change nothing" })
    parseDryRun(): boolean {
        return true
    }

    /** The folder of the seeded graphs. */
    @Option({ flags: "-g, --graphs <folder>", description: "The folder of the seeded graph files", defaultValue: DEFAULT_GRAPHS })
    parseGraphs(value: string): string {
        return value
    }
}
