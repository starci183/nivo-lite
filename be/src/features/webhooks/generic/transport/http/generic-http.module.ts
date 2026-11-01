import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./generic-http.module-definition"
import { GenericWebhook } from "./generic.webhook"

/** The domain proof that authenticates this door before intake. */
export const webhookVerifiers = [ScopedWebhookVerifier.prototype.verify] as const

@Module({ controllers: [GenericWebhook] })
/** The HTTP transport of the generic signed webhook: its door; the intake service and the signature service come from the app capabilities. */
export class GenericHttpModule extends ConfigurableModuleClass {}
