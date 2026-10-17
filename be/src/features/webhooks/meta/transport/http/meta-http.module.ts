import { Module } from "@nestjs/common"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { MetaWebhookVerifierService } from "@modules/domain/meta-inbox"
import { ConfigurableModuleClass } from "./meta-http.module-definition"
import { MetaWebhook } from "./meta.webhook"

export const webhookVerifiers = [
    MetaWebhookVerifierService.prototype.verify,
    MetaConnectionsService.prototype.respondToChallenge,
] as const

@Module({ controllers: [MetaWebhook] })
/** The Meta webhook door; its verifier and inbox come from the app's domain capabilities. */
export class MetaHttpModule extends ConfigurableModuleClass {}
