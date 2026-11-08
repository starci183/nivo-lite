import { Injectable, type OnModuleInit } from "@nestjs/common"
import { isValidZaloMac, zaloEventNameOf } from "@modules/integrations/zalo"
import {
    InjectWebhookProofRegistry,
    type WebhookProof,
    type WebhookProofRegistry,
    type WebhookProofRequest,
} from "@modules/platform/http-security"
import { InjectLogger, type Logger } from "@modules/platform/logging"
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

    /** The event name of the refused delivery when it can be read from the body, for the refusal log; the body itself is never logged. */
    facts(request: WebhookProofRequest): Readonly<Record<string, string>> {
        const eventName = zaloEventNameOf(request.rawBody)
        return eventName === null ? {} : { eventName }
    }

    /**
     * True when the mac matches the bytes received; a missing body or header, a route that is no connection id and a body that is not
     * JSON are false. A connection that cannot prove anything yet (none under that id, or no OA secret key: Zalo shows the key only after
     * the address answered its check with 200) is let through and logged as unverified: the intake then acknowledges it and drops it.
     */
    async prove(request: WebhookProofRequest): Promise<boolean> {
        if (request.rawBody === undefined || !UUID.test(request.scope)) return false
        const loaded = await this.credentials.load(request.scope)
        if (loaded.kind !== "ok") {
            this.logger.warn(ChannelsLogEvent.ZaloWebhookUnverified, {
                connectionId: request.scope,
                reason: loaded.code,
            })
            return true
        }
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
