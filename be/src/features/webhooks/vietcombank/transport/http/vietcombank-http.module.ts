import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./vietcombank-http.module-definition"
import { VietcombankWebhook } from "./vietcombank.webhook"

/** The domain proof that authenticates this provider delivery before intake. */
export const webhookVerifiers = [ScopedWebhookVerifier.prototype.verify] as const

@Module({ controllers: [VietcombankWebhook] })
/** The HTTP transport of the simulated Vietcombank feed; the proof and the intake come from the app's billing capability. */
export class VietcombankHttpModule extends ConfigurableModuleClass {}
