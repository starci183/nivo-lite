import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./payment-receipts.module-definition"
import { SendPaymentReceiptHandler } from "./application/send-payment-receipt.handler"

@Module({ providers: [SendPaymentReceiptHandler] })
/** The payment-receipts reactor: the handlers its consumers dispatch to. */
export class PaymentReceiptsModule extends ConfigurableModuleClass {}
