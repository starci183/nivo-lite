import { CommandRunner, Option, SubCommand } from "nest-commander"
import { WorkspaceCleanupService } from "@modules/domain/workspace-cleanup"
import type { CleanupCommand } from "@modules/domain/workspace-cleanup"

@SubCommand({
    name: "run",
    description:
        "Print the cleanup receipt (--dry-run), or delete every workspace that is not kept and every account none of them holds (--execute with the receipt digest). Permanent.",
})
/** `cli cleanup-workspaces run --keep <id,...> (--dry-run | --execute --receipt-digest <sha256>) [--allow-kept-cascade]`. */
export class RunCleanupWorkspacesCli extends CommandRunner {
    constructor(private readonly workspaceCleanup: WorkspaceCleanupService) {
        super()
    }

    /** Hands the parsed options to the cleanup, which prints the receipt line. */
    async run(_passedParams: Array<string>, options: CleanupCommand = {}): Promise<void> {
        await this.workspaceCleanup.run(options)
    }

    /** The comma-separated workspace ids to keep. */
    @Option({ flags: "--keep <workspaceIds>", description: "The workspace ids to keep, comma-separated; required" })
    parseKeep(value: string): string {
        return value
    }

    /** Prints the receipt and deletes nothing. */
    @Option({ flags: "--dry-run", description: "Print the receipt and its digest; delete nothing" })
    parseDryRun(): boolean {
        return true
    }

    /** Deletes after a fresh dry run whose digest matches. */
    @Option({ flags: "--execute", description: "Delete, only when a fresh dry run has the reviewed receipt digest" })
    parseExecute(): boolean {
        return true
    }

    /** Lets an account delete cascade-delete kept rows, which the receipt then lists. */
    @Option({
        flags: "--allow-kept-cascade",
        description: "Allow account deletes to cascade-delete rows of the kept workspaces; the receipt lists them",
    })
    parseAllowKeptCascade(): boolean {
        return true
    }

    /** The digest of the reviewed receipt. */
    @Option({ flags: "--receipt-digest <sha256>", description: "The digest of the reviewed dry-run receipt" })
    parseReceiptDigest(value: string): string {
        return value
    }
}
