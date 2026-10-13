import { CommandHandler } from "@nestjs/cqrs"
import { HiringJobsService } from "@modules/domain/hiring"
import type { GenerateAdOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GenerateHiringAdCommand } from "./generate-hiring-ad.command"

@CommandHandler(GenerateHiringAdCommand)
/** Draft the copy-ready ads of a job. */
export class GenerateHiringAdHandler extends ICQRSHandler<GenerateHiringAdCommand, GenerateAdOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly jobs: HiringJobsService,
    ) {
        super(logger)
    }

    protected override process(command: GenerateHiringAdCommand): Promise<GenerateAdOutput> {
        return this.jobs.generateAd(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
