import { Module } from "@nestjs/common"
import { ZaloWebhook } from "./zalo.webhook"

@Module({ controllers: [ZaloWebhook] })
/** The HTTP transport of the Zalo webhook: its door; the intake service and the signature service come from the app capabilities. */
export class ZaloHttpModule {}
