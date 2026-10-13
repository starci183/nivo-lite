import { Module } from "@nestjs/common"
import { TelegramWebhook } from "./telegram.webhook"

@Module({ controllers: [TelegramWebhook] })
/** The HTTP transport of the Telegram webhook: its door; the intake service and the signature service come from the app capabilities. */
export class TelegramHttpModule {}
