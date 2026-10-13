import { CommandHandler } from "@nestjs/cqrs"
import { HiringCandidatesService } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ToggleHiringOnboardingCommand } from "./toggle-hiring-onboarding.command"

@CommandHandler(ToggleHiringOnboardingCommand)
/** Tick or untick an onboarding item. */
export class ToggleHiringOnboardingHandler extends ICQRSHandler<ToggleHiringOnboardingCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly candidates: HiringCandidatesService,
    ) {
        super(logger)
    }

    protected override process(command: ToggleHiringOnboardingCommand): Promise<void> {
        return this.candidates.toggleOnboarding(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
