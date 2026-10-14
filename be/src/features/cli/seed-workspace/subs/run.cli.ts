import { CommandRunner, SubCommand } from "nest-commander"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"

@SubCommand({
    name: "run",
    description:
        "Seed the demo accounts, the owner workspace and both memberships; fresh passwords are shown once and never stored",
})
/** `cli seed-workspace run`: seeds the demo account; fresh passwords are shown once in the terminal and never stored. */
export class RunSeedWorkspaceCli extends CommandRunner {
    constructor(private readonly workspaceSeed: WorkspaceSeedService) {
        super()
    }

    /** Seeds the demo account. */
    async run(): Promise<void> {
        await this.workspaceSeed.seedOperator()
    }
}
