import { Module } from "@nestjs/common"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { MetaInboxService } from "@modules/domain/meta-inbox"
import { MetaWebhook } from "./meta.webhook"

export const webhookVerifiers = [
    MetaInboxService.prototype.accept,
    MetaConnectionsService.prototype.respondToChallenge,
] as const

@Module({ controllers: [MetaWebhook] })
/** The Meta webhook door; its verifier and inbox come from the app's domain capabilities. */
export class MetaHttpModule {}
