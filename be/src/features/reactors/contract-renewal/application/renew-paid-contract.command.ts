import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RenewPaidContractRequest } from "./renew-paid-contract.contracts"

/** Asks to apply one delivered payment_reconciled event; the payment_reconciled consumer sends it for every delivery. */
export class RenewPaidContractCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<RenewPaidContractRequest>) {
        super()
    }
}
