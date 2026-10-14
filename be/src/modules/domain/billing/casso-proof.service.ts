import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectWebhookProofRegistry } from "@modules/platform/http-security"
import type { WebhookProof, WebhookProofRegistry, WebhookProofRequest } from "@modules/platform/http-security"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"

@Injectable()
/** Proves a Casso delivery through the existing connection-specific payment proof. */
export class CassoProofService implements WebhookProof, OnModuleInit {
    /** The provider whose door uses this proof. */
    readonly provider = "casso"

    constructor(
        @InjectWebhookProofRegistry() private readonly registry: WebhookProofRegistry,
        private readonly paymentProof: PaymentProofService,
    ) {}

    /** Registers this proof for the Casso door. */
    onModuleInit(): void {
        this.registry.add(this)
    }

    /** Accepts only a delivery accepted by the payment proof; operational failures propagate. */
    async prove(request: WebhookProofRequest): Promise<boolean> {
        try {
            await this.paymentProof.proveCasso({
                connectionId: request.scope,
                rawBody: request.rawBody,
                signature: request.signature,
                // The V1 token rides the timestamp slot because the request type has no second header.
                secureToken: request.timestamp,
            })
            return true
        } catch (error) {
            if (
                error instanceof BillingError &&
                (error.code === BillingErrorCode.WebhookUnauthorized || error.code === BillingErrorCode.WebhookInvalid)
            ) {
                return false
            }
            throw error
        }
    }
}
