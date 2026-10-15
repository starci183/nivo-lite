import { Module } from "@nestjs/common"
import { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import { SepayWebhook } from "./sepay.webhook"

/** The domain proof that authenticates a SePay billing delivery before settlement intake. */
export const webhookVerifiers = [SepayTransactionsService.prototype.verifySepayDelivery] as const

@Module({ controllers: [SepayWebhook] })
/** The HTTP transport of SePay: NIVO's own billing door; the proof and the intake come from the app's billing capability. */
export class SepayHttpModule {}
