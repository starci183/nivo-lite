import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SettleBankCreditRequest } from "./settle-bank-credit.contracts"

/** Asks to apply one delivered bank_credit_booked event; the bank_credit_booked consumer sends it for every delivery. */
export class SettleBankCreditCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<SettleBankCreditRequest>) {
        super()
    }
}
