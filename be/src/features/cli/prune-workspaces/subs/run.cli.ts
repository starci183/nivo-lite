import { CommandRunner, Option, SubCommand } from "nest-commander"
import { StdioConsoleClient, WorkspacePruneService } from "@modules/domain/workspaces"
import type { PruneRequest } from "@modules/domain/workspaces"

@SubCommand({
    name: "run",
    description: "List the workspaces, then delete every one that is not kept after a typed confirmation. Permanent.",
})
/** `cli prune-workspaces run [--keep <id>]... [--no-default] [--yes]`: deletes the workspaces that are not kept. */
export class RunPruneWorkspacesCli extends CommandRunner {
    constructor(private readonly workspacePrune: WorkspacePruneService) {
        super()
    }

    /** Hands the parsed options and the operator terminal to the prune. */
    async run(_passedParams: Array<string>, options: PruneRequest = {}): Promise<void> {
        await this.workspacePrune.prune(options, new StdioConsoleClient(process.stdin, process.stdout))
    }

    /** Collects every `--keep` id. */
    @Option({
        flags: "--keep <workspaceId>",
        description: "A workspace to keep besides the built-in one; repeat for more",
    })
    collectKeep(value: string, previous: Array<string> = []): Array<string> {
        return [...previous, value]
    }

    /** Drops the built-in workspace from the kept ones. */
    @Option({
        flags: "--no-default",
        description: "Do not keep the built-in workspace (a local database does not have it)",
    })
    dropDefault(): boolean {
        return false
    }

    /** Skips the typed confirmation. */
    @Option({ flags: "--yes", description: "Do not ask for the confirmation" })
    assumeYes(): boolean {
        return true
    }
}
