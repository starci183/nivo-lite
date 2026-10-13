import { Command } from "@nestjs/cqrs"
import type { UpgradeOrder } from "@modules/domain/credits"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpgradePlanRequest } from "./upgrade-plan.contracts"

/** Asks for a pending upgrade order to a higher plan for the prorated difference. */
export class UpgradePlanCommand extends Command<UpgradeOrder> {
    constructor(readonly params: ExecuteParams<UpgradePlanRequest>) {
        super()
    }
}
