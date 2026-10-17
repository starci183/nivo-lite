import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./telegram-http.module-definition"
import { TelegramWebhook } from "./telegram.webhook"

/** The domain proof that authenticates this provider delivery before intake. */
export const webhookVerifiers = [ScopedWebhookVerifier.prototype.verify] as const

@Module({ controllers: [TelegramWebhook] })
/** The HTTP transport of the Telegram webhook: its door; the intake service and the signature service come from the app capabilities. */
export class TelegramHttpModule extends ConfigurableModuleClass {}
