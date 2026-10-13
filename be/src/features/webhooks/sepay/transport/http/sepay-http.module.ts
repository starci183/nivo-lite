import { Module } from "@nestjs/common"
import { SepayFeedWebhook } from "./sepay-feed.webhook"
import { SepayWebhook } from "./sepay.webhook"

@Module({ controllers: [SepayWebhook, SepayFeedWebhook] })
/** The HTTP transport of SePay: NIVO's own billing door and the door of a workspace's own bank feed; the proofs and intakes come from the app's billing capability. */
export class SepayHttpModule {}
