import { CommandHandler } from "@nestjs/cqrs"
import { HiringPublicService } from "@modules/domain/hiring"
import type { ApplyOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApplyToHiringJobCommand } from "./apply-to-hiring-job.command"

@CommandHandler(ApplyToHiringJobCommand)
/** Apply for a job. */
export class ApplyToHiringJobHandler extends ICQRSHandler<ApplyToHiringJobCommand, ApplyOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publicService: HiringPublicService,
    ) {
        super(logger)
    }

    protected override process(command: ApplyToHiringJobCommand): Promise<ApplyOutput> {
        return this.publicService.apply(command.params.request)
    }
}
