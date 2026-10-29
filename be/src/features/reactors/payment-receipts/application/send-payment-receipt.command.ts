import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SendPaymentReceiptRequest } from "./send-payment-receipt.contracts"

/** Asks to apply one delivered payment_reconciled event; the payment_reconciled consumer sends it for every delivery. */
export class SendPaymentReceiptCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<SendPaymentReceiptRequest>) {
        super()
    }
}
