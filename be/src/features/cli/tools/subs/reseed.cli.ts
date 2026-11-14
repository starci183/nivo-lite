import { readFile } from "node:fs/promises"
import { CommandRunner, Option, SubCommand } from "nest-commander"
import { RESEED_MAP_DESCRIPTION, ToolReseedCommandService, type ReseedCommandOptions } from "@modules/domain/tool-reseed"

@SubCommand({
    name: "reseed",
    description:
        "Put every agent on the templates the installation ships at their one current version and every stored right on the new tool ids: refuses --execute while anything is open; re-keys tool grants, endpoint rights, openapi ticks and node rows through the rename map; publishes the primary flow, runs the install road, writes a new version of every other workflow that runs another graph, pauses a workflow whose template is gone, derives the node rows again; never touches run history, the call log, the effect ledger, work items or business records; dry by default, --execute writes exactly what the dry run printed",
})
/**
 * `cli tools reseed [--workspace <id>] [--map <file>] [--dry-run] [--execute]`: hands the flags, the file reader, stdout and the
 * process's exit code to the re-seed command. The process ends non-zero when it was refused or an agent failed.
 */
export class ReseedToolsCli extends CommandRunner {
    constructor(private readonly commands: ToolReseedCommandService) {
        super()
    }

    /** Runs the re-seed; it prints its report on stdout. */
    run(_passedParams: Array<string>, options: ReseedCommandOptions = {}): Promise<void> {
        return this.commands.run(process.stdout, process, options, readFile)
    }

    /** Only one workspace. */
    @Option({ flags: "--workspace <id>", description: "Only this workspace (default: every workspace)" })
    parseWorkspace(value: string): string {
        return value
    }

    /** The map file. */
    @Option({ flags: "--map <file>", description: RESEED_MAP_DESCRIPTION })
    parseMap(value: string): string {
        return value
    }

    /** Only print (the default). */
    @Option({ flags: "--dry-run", description: "Print what --execute would do and write nothing (the default)" })
    parseDryRun(): boolean {
        return true
    }

    /** Write. */
    @Option({ flags: "--execute", description: "Write (refused while anything is open)" })
    parseExecute(): boolean {
        return true
    }
}
