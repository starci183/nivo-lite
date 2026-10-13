import { CommandRunner, SubCommand } from "nest-commander"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"

@SubCommand({
    name: "run",
    description: "Seed the demo accounts, the owner workspace and both memberships; passwords stay in the secrets file",
})
/** `cli seed-workspace run`: seeds the demo account; the passwords live in the operator secrets file. */
export class RunSeedWorkspaceCli extends CommandRunner {
    constructor(private readonly workspaceSeed: WorkspaceSeedService) {
        super()
    }

    /** Seeds the demo account. */
    async run(): Promise<void> {
        await this.workspaceSeed.seedOperator()
    }
}
