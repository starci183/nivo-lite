import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ReactToDealWonRequest } from "./react-to-deal-won.contracts"

/** Asks to apply one delivered deal_won event; the deal_won consumer sends it for every delivery. */
export class ReactToDealWonCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<ReactToDealWonRequest>) {
        super()
    }
}
