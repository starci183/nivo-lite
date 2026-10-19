import { CommandRunner, SubCommand } from "nest-commander"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"

@SubCommand({
    name: "run",
    description: "Ensure the explicitly selected workspace from private target input without rotating credentials",
})
/** The safe run alias requires the same private target input as ensure and emits no credentials. */
export class RunSeedWorkspaceCli extends CommandRunner {
    constructor(private readonly workspaceSeed: WorkspaceSeedService) {
        super()
    }

    /** Seeds the demo account. */
    async run(): Promise<void> {
        await this.workspaceSeed.seedOperator()
    }
}
