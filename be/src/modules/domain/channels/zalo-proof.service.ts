import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { isValidZaloMac } from "@modules/integrations/zalo"
import { InjectWebhookProofRegistry } from "@modules/platform/http-security"
import type { WebhookProof, WebhookProofRegistry, WebhookProofRequest } from "@modules/platform/http-security"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelsLogEvent } from "./channels.log-events"
import { ZaloCredentialsService } from "./zalo-credentials.service"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

@Injectable()
/**
 * The proof of a Zalo delivery: the signature header is a mac over the app id, the raw body, the event time and the OA secret key of THIS connection's
 * credential, so an event can only ever reach the workspace that registered this OA.
 */
export class ZaloProofService implements WebhookProof, OnModuleInit {
    readonly provider = "zalo"

    constructor(
        @InjectWebhookProofRegistry() private readonly registry: WebhookProofRegistry,
        @InjectLogger() private readonly logger: Logger,
        private readonly credentials: ZaloCredentialsService,
    ) {}

    /** Registers this proof for the zalo door. */
    onModuleInit(): void {
        this.registry.add(this)
    }

    /** True only when the mac matches the bytes received; a missing connection, body or header, and a body that is not JSON, are false. */
    async prove(request: WebhookProofRequest): Promise<boolean> {
        if (request.rawBody === undefined || !UUID.test(request.scope)) return false
        const loaded = await this.credentials.load(request.scope)
        if (loaded.kind !== "ok") return false
        const { appId, oaSecret } = loaded.value.secret
        const body = request.rawBody.toString("utf8")
        return Promise.resolve()
            .then(() => isValidZaloMac(appId, body, oaSecret, request.signature))
            .catch((cause: unknown) => {
                this.logger.warn(ChannelsLogEvent.ProofBodyUnreadable, {
                    connectionId: request.scope,
                    reason: String(cause),
                })
                return false
            })
    }
}
