import { CommandRunner, SubCommand } from "nest-commander"
import { JobOpsTickService } from "@modules/domain/job-ops"

@SubCommand({ name: "tick", description: "Enqueue one migration-owned scheduler tick", arguments: "<schedulerId>" })
/** `cli jobs tick <schedulerId>`: sends one idempotent operator tick. */
export class TickJobsCli extends CommandRunner {
    constructor(private readonly ticks: JobOpsTickService) {
        super()
    }

    /** Hands the scheduler id to the tick capability for validation and enqueueing. */
    async run([id = ""]: Array<string>): Promise<void> {
        await this.ticks.tick(id)
    }
}
