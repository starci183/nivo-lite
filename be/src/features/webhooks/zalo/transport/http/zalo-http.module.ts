import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./zalo-http.module-definition"
import { ZaloWebhook } from "./zalo.webhook"

/** The domain proof that authenticates this provider delivery before intake. */
export const webhookVerifiers = [ScopedWebhookVerifier.prototype.verify] as const

@Module({ controllers: [ZaloWebhook] })
/** The HTTP transport of the Zalo webhook: its door; the intake service and the signature service come from the app capabilities. */
export class ZaloHttpModule extends ConfigurableModuleClass {}
