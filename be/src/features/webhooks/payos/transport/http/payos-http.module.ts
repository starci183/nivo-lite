import { Module } from "@nestjs/common"
import { PayosWebhook } from "./payos.webhook"

@Module({ controllers: [PayosWebhook] })
/** The HTTP transport of payOS: a workspace's bank-feed door; the proof and the intake come from the app's billing capability. */
export class PayosHttpModule {}
