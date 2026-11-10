import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { Command, CommandRunner, Option } from "nest-commander"
import { WorkflowResetService } from "@modules/domain/workspace-seed"

/** What `reset-workflows` is asked to do, as the command line parsed it. */
export interface ResetWorkflowsCommand {
    /** The name of the workspace whose agents' workflows are reset. */
    readonly workspace: string
    /** The folder of the seeded graph files, one JSON graph spec per module. */
    readonly graphs: string
    /** True counts what the reset would clear, per kind, and changes nothing. */
    readonly dryRun?: boolean | undefined
}

/** The folder of the seeded graphs, relative to the lane root the command runs in. */
const DEFAULT_GRAPHS = ".starcistacks/dev/seeds/data/graphs"

@Command({
    name: "reset-workflows",
    description:
        "Replace the workflows of the Chatbot, Sales and Accounting agents of a workspace with the seeded graphs, clearing their runs and the lead memory",
})
/**
 * `cli reset-workflows --workspace <name> [--graphs <folder>] [--dry-run]`: the workflow-only reset (`--dry-run` prints the counts per
 * kind and changes nothing). It reads every `.json` graph of the folder into
 * the envelope the stack seed step writes, and hands it to the reset, which keeps agents and every other record. Idempotent.
 */
export class ResetWorkflowsCli extends CommandRunner {
    constructor(private readonly reset: WorkflowResetService) {
        super()
    }

    /** Reads the graphs of the folder, in name order, and runs the reset. */
    async run(_params: Array<string>, options: ResetWorkflowsCommand): Promise<void> {
        const names = (await readdir(options.graphs)).filter((name) => name.endsWith(".json")).toSorted()
        const documents = await Promise.all(
            names.map(async (name) => ({ document: JSON.parse(await readFile(join(options.graphs, name), "utf8")) as unknown })),
        )
        const text = JSON.stringify({ documents })
        if (options.dryRun === true) await this.reset.run(text, options.workspace, { dryRun: true })
        else await this.reset.run(text, options.workspace)
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
