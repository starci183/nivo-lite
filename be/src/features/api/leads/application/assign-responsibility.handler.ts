import { CommandHandler } from "@nestjs/cqrs"
import { ResponsibilitiesService } from "@modules/domain/responsibilities"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AssignResponsibilityCommand } from "./assign-responsibility.command"
import type { AssignResponsibilityResult } from "./assign-responsibility.contracts"

@CommandHandler(AssignResponsibilityCommand)
/** Reassigns a responsibility through one domain-service call. */
export class AssignResponsibilityHandler extends ICQRSHandler<AssignResponsibilityCommand, AssignResponsibilityResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly responsibilitiesService: ResponsibilitiesService,
    ) {
        super(logger)
    }

    protected override process(command: AssignResponsibilityCommand): Promise<AssignResponsibilityResult> {
        return this.responsibilitiesService.assignResponsibility(command.params.request)
    }
}
