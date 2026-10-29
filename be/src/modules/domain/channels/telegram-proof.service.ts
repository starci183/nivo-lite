import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { safeEqual } from "@modules/domain/connection-secrets"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { InjectWebhookProofRegistry } from "@modules/platform/http-security"
import type { WebhookProof, WebhookProofRegistry, WebhookProofRequest } from "@modules/platform/http-security"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

@Injectable()
/**
 * The proof of a Telegram delivery: the connection's own random secret must arrive in the secret-token header. The workspace and the bot
 * token come from the connection, so a message can only ever reach the workspace that registered this bot.
 */
export class TelegramProofService implements WebhookProof, OnModuleInit {
    readonly provider = "telegram"

    constructor(
        @InjectWebhookProofRegistry() private readonly registry: WebhookProofRegistry,
        private readonly secrets: ConnectionSecretReadsService,
    ) {}

    /** Registers this proof for the telegram door. */
    onModuleInit(): void {
        this.registry.add(this)
    }

    /** True only when the header equals the secret of the connection the route names; any missing piece is false. */
    async prove(request: WebhookProofRequest): Promise<boolean> {
        if (request.signature === undefined || !UUID.test(request.scope)) return false
        const secret = await this.secrets.secretOf(request.scope, "telegram")
        return secret.kind === "ok" && safeEqual(request.signature, secret.value.webhookSecret)
    }
}
