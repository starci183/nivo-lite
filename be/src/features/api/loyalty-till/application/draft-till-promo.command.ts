import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { DraftTillPromoRequest, DraftTillPromoResult } from "./draft-till-promo.contracts"

/** Writes the draft of a promotion for the owner to approve. */
export class DraftTillPromoCommand extends Command<DraftTillPromoResult> {
    constructor(readonly params: PublicExecuteParams<DraftTillPromoRequest>) {
        super()
    }
}
