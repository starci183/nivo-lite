import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import {
    InjectWebhookDeliveryClient,
    WebhookDeliveryError,
    type WebhookDeliveryClient,
} from "@modules/integrations/webhook-delivery"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WebhookConnectionsError, WebhookConnectionsErrorCode } from "./errors/webhook-connections.error"
import { WebhookConnectionsLogEvent } from "./webhook-connections.log-events"
import type { WebhookSendPort, WebhookSendRequest, WebhookSendResult } from "./webhook-send.port"

@Injectable()
/**
 * The LIVE outgoing webhook: reads the sealed receiver address of the account, resolves it as a delivery target (a private address is
 * refused unless the deployment has no public origin) and posts the signed delivery there. An account holding no readable address is the
 * typed `NO_URL`, an address that cannot be a target the typed `URL_REFUSED` (its cause is the delivery client's refusal); what the
 * receiver answered, or why none did, is the result.
 */
export class WebhookLiveSendService implements WebhookSendPort {
    /** The provider key. */
    readonly provider = "webhook" as const

    constructor(
        private readonly connections: ConnectionsService,
        @InjectWebhookDeliveryClient() private readonly delivery: WebhookDeliveryClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Posts one signed delivery to the receiver the account holds. */
    async post(connection: ConnectionRecord, request: WebhookSendRequest): Promise<WebhookSendResult> {
        const url = await this.urlOf(connection)
        if (url === null) throw new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.NoUrl })
        let target: URL
        try {
            target = await this.delivery.resolveTarget(url, this.connections.publicOrigin() !== null)
        } catch (error) {
            if (error instanceof WebhookDeliveryError) {
                throw new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.UrlRefused, cause: error })
            }
            throw error
        }
        return await this.delivery.post({ url: target, body: request.body, headers: request.headers })
    }

    private async urlOf(connection: ConnectionRecord): Promise<string | null> {
        const secret = await this.connections.readSecret(connection.id)
        if (secret === null) return null
        try {
            const parsed: unknown = JSON.parse(secret.plain)
            const url = typeof parsed === "object" && parsed !== null && "url" in parsed ? parsed.url : null
            return typeof url === "string" && url !== "" ? url : null
        } catch (cause) {
            this.logger.error(WebhookConnectionsLogEvent.AddressUnreadable, cause, { connectionId: connection.id })
            return null
        }
    }
}
