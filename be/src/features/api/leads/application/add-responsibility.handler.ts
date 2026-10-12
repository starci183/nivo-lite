import { CommandHandler } from "@nestjs/cqrs"
import { ResponsibilitiesService } from "@modules/domain/responsibilities"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AddResponsibilityCommand } from "./add-responsibility.command"
import type { AddResponsibilityResult } from "./add-responsibility.contracts"

@CommandHandler(AddResponsibilityCommand)
/** Adds the next responsibility of a lead through one domain-service call. */
export class AddResponsibilityHandler extends ICQRSHandler<AddResponsibilityCommand, AddResponsibilityResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly responsibilitiesService: ResponsibilitiesService,
    ) {
        super(logger)
    }

    protected override process(command: AddResponsibilityCommand): Promise<AddResponsibilityResult> {
        return this.responsibilitiesService.addResponsibility(command.params.request)
    }
}
