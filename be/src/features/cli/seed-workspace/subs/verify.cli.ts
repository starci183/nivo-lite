import { CommandRunner, SubCommand } from "nest-commander"
import { WorkspaceSeedService } from "@modules/domain/workspace-seed"

@SubCommand({ name: "verify", description: "Reconcile an uncertain workspace action by authenticated readback" })
/** Recovery entry without domain writes; password authentication owns and cleans up its Auth session. */
export class VerifySeedWorkspaceCli extends CommandRunner {
    constructor(private readonly workspaceSeed: WorkspaceSeedService) {
        super()
    }

    /** Delegates the frozen input to authenticated readback with the same declared authentication scope. */
    async run(): Promise<void> {
        await this.workspaceSeed.verifyOperator()
    }
}
