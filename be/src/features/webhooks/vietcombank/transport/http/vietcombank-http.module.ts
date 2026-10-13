import { Module } from "@nestjs/common"
import { VietcombankWebhook } from "./vietcombank.webhook"

@Module({ controllers: [VietcombankWebhook] })
/** The HTTP transport of the simulated Vietcombank feed; the proof and the intake come from the app's billing capability. */
export class VietcombankHttpModule {}
