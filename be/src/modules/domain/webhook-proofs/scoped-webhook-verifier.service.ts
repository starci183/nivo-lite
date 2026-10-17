import { Injectable } from "@nestjs/common"
import { InjectWebhookProofRegistry } from "@modules/platform/http-security"
import type { WebhookProofRegistry } from "@modules/platform/http-security"

import type { ScopedWebhookDelivery } from "./webhook-proofs.contracts"
import type { WebhookVerifier } from "./webhook-proofs.port"

@Injectable()
/** Verifies webhook deliveries using the registered proof for their provider and scope. */
export class ScopedWebhookVerifier implements WebhookVerifier {
    constructor(@InjectWebhookProofRegistry() private readonly proofs: WebhookProofRegistry) {}

    /** Rejects unless the provider's registered proof accepts the delivery for its scope. */
    async verify(delivery: ScopedWebhookDelivery): Promise<void> {
        await this.proofs.verify(delivery.provider, {
            scope: delivery.scope,
            rawBody: delivery.rawBody,
            signature: delivery.signature,
            timestamp: delivery.timestamp,
        })
    }
}
