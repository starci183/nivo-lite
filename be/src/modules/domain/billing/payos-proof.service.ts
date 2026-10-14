import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectWebhookProofRegistry } from "@modules/platform/http-security"
import type { WebhookProof, WebhookProofRegistry, WebhookProofRequest } from "@modules/platform/http-security"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"

@Injectable()
/** The payOS door's proof, delegated to the billing verifier that reads the signature from the raw body. */
export class PayosProofService implements WebhookProof, OnModuleInit {
    /** The provider key used by the payOS door. */
    readonly provider = "payos"

    constructor(
        @InjectWebhookProofRegistry() private readonly registry: WebhookProofRegistry,
        private readonly payments: PaymentProofService,
    ) {}

    /** Registers this proof for the payOS door. */
    onModuleInit(): void {
        this.registry.add(this)
    }

    /** Accepts a proven payment or payOS confirmation sample; a refused signature or invalid body proves nothing. */
    async prove(request: WebhookProofRequest): Promise<boolean> {
        try {
            await this.payments.provePayos({ connectionId: request.scope, rawBody: request.rawBody })
            return true
        } catch (cause) {
            if (
                cause instanceof BillingError &&
                (cause.code === BillingErrorCode.WebhookUnauthorized || cause.code === BillingErrorCode.WebhookInvalid)
            ) {
                return false
            }
            throw cause
        }
    }
}
