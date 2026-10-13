import { Command } from "@nestjs/cqrs"
import type { CardRecord } from "@modules/domain/module-setup-writes"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideSetupCardRequest } from "./decide-setup-card.contracts"

/** Asks to confirm (optionally edited) or reject one confirm card. */
export class DecideSetupCardCommand extends Command<CardRecord> {
    constructor(readonly params: ExecuteParams<DecideSetupCardRequest>) {
        super()
    }
}
