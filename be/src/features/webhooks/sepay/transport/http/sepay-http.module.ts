import { Module } from "@nestjs/common"
import { SepayWebhook } from "./sepay.webhook"

@Module({ controllers: [SepayWebhook] })
/** The HTTP transport of SePay: NIVO's own billing door; the proof and the intake come from the app's billing capability. */
export class SepayHttpModule {}
