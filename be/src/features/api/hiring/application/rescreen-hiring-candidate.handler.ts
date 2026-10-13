import { CommandHandler } from "@nestjs/cqrs"
import { HiringScreeningService } from "@modules/domain/hiring"
import type { RescreenOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RescreenHiringCandidateCommand } from "./rescreen-hiring-candidate.command"

@CommandHandler(RescreenHiringCandidateCommand)
/** Screen a candidate again. */
export class RescreenHiringCandidateHandler extends ICQRSHandler<RescreenHiringCandidateCommand, RescreenOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly screening: HiringScreeningService,
    ) {
        super(logger)
    }

    protected override process(command: RescreenHiringCandidateCommand): Promise<RescreenOutput> {
        return this.screening.rescreen(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
