import type { ScopedWebhookDelivery } from "./webhook-proofs.contracts"

/** Authenticates scoped provider deliveries before a domain intake accepts them. */
export interface WebhookVerifier {
    /** Refuses a delivery unless the provider proves the credentials of its connection. */
    verify(delivery: ScopedWebhookDelivery): Promise<void>
}
