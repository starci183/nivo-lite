import { Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import { timingSafeEqual } from "node:crypto"
import type { EntityManager } from "typeorm"
import { ConnectionBindingsReadService, ConnectionsService } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    InjectWebhookProofRegistry,
    type WebhookProof,
    type WebhookProofRegistry,
    type WebhookProofRequest,
} from "@modules/platform/http-security"
import type { VideoComposePort } from "./video-compose.contracts"
import { VideoComposeRegistryService } from "./video-compose-registry.service"

/** Whether two texts are equal, compared in constant time over their bytes (different lengths are unequal at once). */
const sameSecret = (given: string, held: string): boolean => {
    const a = Buffer.from(given, "utf8")
    const b = Buffer.from(held, "utf8")
    return a.length === b.length && timingSafeEqual(a, b)
}

@Injectable()
/**
 * The webhook proof of every compose provider that has a webhook, registered once the app has booted (every provider module has
 * registered its port by then). The door hands the path's token as the delivery's `signature`: it is proven when the connection is an
 * account of THAT provider and the token equals the connection's own webhook secret (constant time). A provider's own signature is the
 * intake's next check (`VideoRenderIntakeService`, the port's `proves`). A missing account or secret is false, never a throw.
 */
export class VideoRenderProofsService implements OnApplicationBootstrap {
    constructor(
        @InjectWebhookProofRegistry() private readonly proofs: WebhookProofRegistry,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly registry: VideoComposeRegistryService,
        private readonly bindings: ConnectionBindingsReadService,
        private readonly connections: ConnectionsService,
    ) {}

    /** Registers the proof of each compose provider with a webhook. */
    onApplicationBootstrap(): void {
        this.registry
            .providers()
            .flatMap((provider) => this.registry.liveOf(provider) ?? [])
            .filter((port) => port.webhook !== null)
            .forEach((port) => {
                this.proofs.add(this.proofOf(port))
            })
    }

    /** The proof of one provider's render door. */
    proofOf(port: VideoComposePort): WebhookProof {
        return {
            provider: port.provider,
            prove: async (request: WebhookProofRequest): Promise<boolean> => {
                const token = request.signature
                if (token === undefined || token === "") return false
                const account = await this.bindings.accountOf(request.scope, this.entityManager)
                if (account?.provider !== port.provider) return false
                const secrets = await this.connections.readSecret(request.scope)
                return secrets !== null && sameSecret(token, secrets.webhookSecret)
            },
        }
    }
}
