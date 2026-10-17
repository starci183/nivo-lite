import { Injectable } from "@nestjs/common"
import { InjectMetaClient } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import type { RawDelivery, DeliverySignature } from "./meta-inbox.contracts"
import { MetaInboxError, MetaInboxErrorCode } from "./errors/meta-inbox.error"

@Injectable()
/** Proves Meta signatures against the exact delivery bytes before receipt intake. */
export class MetaWebhookVerifierService {
    constructor(@InjectMetaClient() private readonly meta: MetaClient) {}

    /** Rejects a missing body or any signature the Meta client cannot verify. */
    verify(deliveryBytes: RawDelivery, signature: DeliverySignature): void {
        if (deliveryBytes === undefined || !this.meta.verifyDelivery(signature, deliveryBytes)) {
            throw new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid })
        }
    }
}
