import { Command } from "@nestjs/cqrs"
import type { OptionalZnsRenewal } from "@modules/domain/channels"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveZnsRenewalRequest } from "./save-zns-renewal.contracts"

/** Asks for the ZNS renewal template of a Zalo connection to be stored. */
export class SaveZnsRenewalCommand extends Command<OptionalZnsRenewal> {
    constructor(readonly params: ExecuteParams<SaveZnsRenewalRequest>) {
        super()
    }
}
