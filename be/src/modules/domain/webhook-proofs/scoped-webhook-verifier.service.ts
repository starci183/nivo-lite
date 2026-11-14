import { Injectable, Optional } from "@nestjs/common"
import { SandboxWebhookKeyService } from "@modules/domain/provider-sandbox"
import { InjectWebhookProofRegistry, type WebhookProofRegistry } from "@modules/platform/http-security"

import type { ScopedWebhookDelivery } from "./webhook-proofs.contracts"
import type { WebhookVerifier } from "./webhook-proofs.port"

@Injectable()
/** Verifies webhook deliveries using the registered proof for their provider and scope. */
export class ScopedWebhookVerifier implements WebhookVerifier {
    constructor(
        @InjectWebhookProofRegistry() private readonly proofs: WebhookProofRegistry,
        @Optional() private readonly sandboxes?: SandboxWebhookKeyService,
    ) {}

    /**
     * Rejects unless the provider's registered proof accepts the delivery for its scope. The ONE shared sandbox guard is asked first
     * (rulings R58 + R60): a SANDBOX account's delivery is proven by its sandbox key (or refused) and skips the provider proof it has no
     * secret for; every other delivery (a live account, an unknown scope, an app with no sandbox) runs the provider's proof exactly as before.
     */
    async verify(delivery: ScopedWebhookDelivery): Promise<void> {
        const verdict = await this.sandboxes?.verdictOf(delivery.scope, delivery.sandboxKey)
        if (verdict?.kind === "sandbox") return
        await this.proofs.verify(delivery.provider, {
            scope: delivery.scope,
            rawBody: delivery.rawBody,
            signature: delivery.signature,
            timestamp: delivery.timestamp,
        })
    }
}
