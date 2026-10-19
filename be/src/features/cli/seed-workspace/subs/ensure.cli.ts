import { CommandRunner, SubCommand } from "nest-commander"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"

@SubCommand({ name: "ensure", description: "Ensure explicit accounts and workspace memberships from private input" })
/** Fixed operator entry; identity and workspace policy remain in their owning capabilities. */
export class EnsureSeedWorkspaceCli extends CommandRunner {
    constructor(private readonly workspaceSeed: WorkspaceSeedService) {
        super()
    }

    /** Delegates the private request without accepting password or actor arguments. */
    async run(): Promise<void> {
        await this.workspaceSeed.seedOperator()
    }
}
