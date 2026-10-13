import { CommandHandler } from "@nestjs/cqrs"
import { HiringJobsService } from "@modules/domain/hiring"
import type { SetJobStatusOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetHiringJobStatusCommand } from "./set-hiring-job-status.command"

@CommandHandler(SetHiringJobStatusCommand)
/** Open, pause or close a job. */
export class SetHiringJobStatusHandler extends ICQRSHandler<SetHiringJobStatusCommand, SetJobStatusOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly jobs: HiringJobsService,
    ) {
        super(logger)
    }

    protected override process(command: SetHiringJobStatusCommand): Promise<SetJobStatusOutput> {
        return this.jobs.setStatus(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
