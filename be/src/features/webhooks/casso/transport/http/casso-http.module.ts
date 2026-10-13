import { Module } from "@nestjs/common"
import { CassoWebhook } from "./casso.webhook"

@Module({ controllers: [CassoWebhook] })
/** The HTTP transport of Casso: a workspace's bank-feed door; the proof and the intake come from the app's billing capability. */
export class CassoHttpModule {}
