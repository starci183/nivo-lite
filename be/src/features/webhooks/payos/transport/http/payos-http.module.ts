import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./payos-http.module-definition"
import { PayosWebhook } from "./payos.webhook"

/** The domain proof that authenticates this provider delivery before intake. */
export const webhookVerifiers = [ScopedWebhookVerifier.prototype.verify] as const

@Module({ controllers: [PayosWebhook] })
/** The HTTP transport of payOS: a workspace's bank-feed door; the proof and the intake come from the app's billing capability. */
export class PayosHttpModule extends ConfigurableModuleClass {}
