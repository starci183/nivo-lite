import { CommandHandler } from "@nestjs/cqrs"
import { HiringJobsService } from "@modules/domain/hiring"
import type { SaveJobOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveHiringJobCommand } from "./save-hiring-job.command"

@CommandHandler(SaveHiringJobCommand)
/** Create or update one job post. */
export class SaveHiringJobHandler extends ICQRSHandler<SaveHiringJobCommand, SaveJobOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly jobs: HiringJobsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveHiringJobCommand): Promise<SaveJobOutput> {
        return this.jobs.saveJob(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
