import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./casso-http.module-definition"
import { CassoWebhook } from "./casso.webhook"

/** The domain proof that authenticates this provider delivery before intake. */
export const webhookVerifiers = [ScopedWebhookVerifier.prototype.verify] as const

@Module({ controllers: [CassoWebhook] })
/** The HTTP transport of Casso: a workspace's bank-feed door; the proof and the intake come from the app's billing capability. */
export class CassoHttpModule extends ConfigurableModuleClass {}
