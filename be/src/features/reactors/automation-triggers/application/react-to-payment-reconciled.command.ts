import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ReactToPaymentReconciledRequest } from "./react-to-payment-reconciled.contracts"

/** Asks to apply one delivered payment_reconciled event; the payment_reconciled consumer sends it for every delivery. */
export class ReactToPaymentReconciledCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<ReactToPaymentReconciledRequest>) {
        super()
    }
}
