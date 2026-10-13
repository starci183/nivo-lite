import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ToggleHiringOnboardingRequest } from "./toggle-hiring-onboarding.contracts"

/** Asks for tick or untick an onboarding item. */
export class ToggleHiringOnboardingCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ToggleHiringOnboardingRequest>) {
        super()
    }
}
