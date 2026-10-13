import { Module } from "@nestjs/common"
import { SepayFeedWebhook } from "./sepay-feed.webhook"

@Module({ controllers: [SepayFeedWebhook] })
/** The HTTP transport of a workspace's own SePay bank feed; the proof and the intake come from the app's billing capability. */
export class SepayFeedHttpModule {}
