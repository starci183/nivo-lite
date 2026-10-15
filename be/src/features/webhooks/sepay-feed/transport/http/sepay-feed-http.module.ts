import { Module } from "@nestjs/common"
import { BankFeedService } from "@modules/domain/billing"
import { SepayFeedWebhook } from "./sepay-feed.webhook"

/** The feed's declared proof checks its connection's stored API-key digest before intake. */
export const webhookVerifiers = [BankFeedService.prototype.verifySepayFeedDelivery] as const

@Module({ controllers: [SepayFeedWebhook] })
/** The HTTP transport of a workspace's own SePay bank feed; the proof and the intake come from the app's billing capability. */
export class SepayFeedHttpModule {}
