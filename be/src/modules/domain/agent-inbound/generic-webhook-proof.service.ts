import { createHmac } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { safeEqual } from "@modules/domain/connection-secrets"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { InjectWebhookProofRegistry } from "@modules/platform/http-security"
import type { WebhookProof, WebhookProofRegistry, WebhookProofRequest } from "@modules/platform/http-security"
import { GENERIC_WEBHOOK } from "./generic-webhook.adapter"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const PREFIX = "sha256="

/** The hex HMAC-SHA256 of the exact request bytes under the endpoint secret. */
export const signBody = (secret: string, rawBody: Buffer): string =>
    createHmac("sha256", secret).update(rawBody).digest("hex")

@Injectable()
/**
 * The proof of a generic webhook delivery: the hex HMAC-SHA256 of the raw body, under the random secret of the connection the route names
 * (its `webhookSecret`, one per endpoint), must arrive in the signature header, with or without a `sha256=` prefix. The workspace comes from
 * the connection, so a delivery only ever reaches the workspace that owns the endpoint.
 */
export class GenericWebhookProofService implements WebhookProof, OnModuleInit {
    readonly provider = GENERIC_WEBHOOK

    constructor(
        @InjectWebhookProofRegistry() private readonly registry: WebhookProofRegistry,
        private readonly secrets: ConnectionSecretReadsService,
    ) {}

    /** Registers this proof for the generic webhook door. */
    onModuleInit(): void {
        this.registry.add(this)
    }

    /** True only when the signature is the body HMAC under the endpoint secret; any missing piece is false. */
    async prove(request: WebhookProofRequest): Promise<boolean> {
        if (request.signature === undefined || request.rawBody === undefined || !UUID.test(request.scope)) return false
        const secret = await this.secrets.secretOf(request.scope, "webhook")
        if (secret.kind !== "ok") return false
        const given = request.signature.startsWith(PREFIX) ? request.signature.slice(PREFIX.length) : request.signature
        return safeEqual(given, signBody(secret.value.webhookSecret, request.rawBody))
    }
}
