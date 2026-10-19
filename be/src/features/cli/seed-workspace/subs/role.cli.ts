import { CommandRunner, SubCommand } from "nest-commander"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"

@SubCommand({ name: "role", description: "Change an explicit member role as an authenticated workspace actor" })
/** Fixed role entry; the existing domain service enforces owner, manager and last-owner restrictions. */
export class RoleSeedWorkspaceCli extends CommandRunner {
    constructor(private readonly workspaceSeed: WorkspaceSeedService) {
        super()
    }

    /** Delegates session authentication and role authorization together. */
    async run(): Promise<void> {
        await this.workspaceSeed.roleOperator()
    }
}
