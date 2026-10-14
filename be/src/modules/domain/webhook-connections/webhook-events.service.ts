import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InjectWebhookDeliveryClient, WebhookDeliveryError } from "@modules/integrations/webhook-delivery"
import type { WebhookDeliveryClient } from "@modules/integrations/webhook-delivery"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { eachInOrder } from "@modules/platform/primitives"
import { N8N_QUEUE, N8N_WEBHOOK_JOB, isN8nWebhookPayload } from "@modules/queues/n8n"
import type { N8nWebhookPayload } from "@modules/queues/n8n"
import { WebhookConnectionsError, WebhookConnectionsErrorCode } from "./errors/webhook-connections.error"
import type { WebhookPublication } from "./webhook-connections.contracts"
import { InjectWebhookConnectionsOptions } from "./webhook-connections.decorators"
import { WebhookConnectionsLogEvent } from "./webhook-connections.log-events"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"
import { deliveryVerdict, eventsOf, signDelivery, workspaceSigningSecret } from "./webhook-signing.policy"

@Injectable()
/**
 * The business events leaving NIVO through the webhook connections: every connected webhook of the workspace that picked the event
 * gets one signed delivery job (once per connection and occurrence), and the job posts it with the per-workspace signing key and
 * the same headers and signature as the wizard's test.
 */
export class WebhookEventsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectWebhookDeliveryClient() private readonly delivery: WebhookDeliveryClient,
        @InjectWebhookConnectionsOptions() private readonly options: WebhookConnectionsOptions,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly connections: ConnectionsService,
    ) {}

    /**
     * Queues the event for every connected webhook of the workspace that picked it, inside the caller's transaction when it hands
     * one. `dedupe` names the occurrence: publishing it twice queues nothing twice. Nothing is queued while signing is off.
     */
    async publish(publication: WebhookPublication, manager: EntityManager = this.entityManager): Promise<void> {
        if (this.options.signingSecret === undefined) return
        const { workspaceId, event, data, dedupe } = publication
        const subscribed = (
            await this.connections.listByProvider(workspaceId, "webhook", { includeDisconnected: false })
        ).filter((connection) => connection.status === "connected" && eventsOf(connection.meta).includes(event))
        const occurredAtMs = this.clock.now().getTime()
        await eachInOrder(subscribed, async (connection) => {
            const job: N8nWebhookPayload = {
                workspaceId,
                connectionId: connection.id,
                deliveryId: `${connection.id}:${dedupe}`,
                event,
                data,
                occurredAtMs,
            }
            await this.outbox.write(manager, N8N_QUEUE, job, {
                job: N8N_WEBHOOK_JOB,
                dedupeKey: `${N8N_WEBHOOK_JOB}:${job.deliveryId}`,
            })
        })
    }

    /**
     * The effect of one delivery job: posts the signed event to the connection's address. A receiver that is down, slow or busy
     * throws so the queue retries; an address NIVO may not call or a 4xx answer is recorded on the connection and not retried.
     */
    async deliver(job: object): Promise<void> {
        if (!isN8nWebhookPayload(job)) return
        const connection = await this.connections.find(job.workspaceId, job.connectionId)
        const shared = this.options.signingSecret
        const url = connection === null ? null : await this.urlOf(connection)
        if (connection === null || connection.status !== "connected" || shared === undefined || url === null) {
            this.logger.warn(WebhookConnectionsLogEvent.DeliveryDropped, { connectionId: job.connectionId })
            return
        }
        const target = await this.target(connection, url)
        if (target === null) return
        const body = JSON.stringify({
            id: job.deliveryId,
            event: job.event,
            workspace_id: job.workspaceId,
            occurred_at: new Date(job.occurredAtMs).toISOString(),
            data: job.data,
        })
        const timestamp = String(job.occurredAtMs)
        const key = workspaceSigningSecret(shared.reveal(), job.workspaceId)
        const result = await this.delivery.post({
            url: target,
            body,
            headers: {
                "x-nivo-event": job.event,
                "x-nivo-delivery": job.deliveryId,
                "x-nivo-timestamp": timestamp,
                "x-nivo-signature": signDelivery(key, timestamp, body),
            },
        })
        await this.settle(connection, result.status)
    }

    private async settle(connection: ConnectionRecord, status: number | null): Promise<void> {
        const verdict = deliveryVerdict(status)
        if (verdict === "retry") {
            throw new WebhookConnectionsError({
                code: WebhookConnectionsErrorCode.DeliveryFailed,
                params: { status: status === null ? "none" : String(status) },
            })
        }
        if (verdict === "delivered") {
            if (connection.lastError !== null) {
                await this.connections.patch(connection.workspaceId, connection.id, { lastError: null })
            }
            return
        }
        this.logger.warn(WebhookConnectionsLogEvent.DeliveryRefused, { connectionId: connection.id, status })
        await this.connections.patch(connection.workspaceId, connection.id, { lastError: `HTTP ${String(status)}` })
    }

    private async target(connection: ConnectionRecord, url: string): Promise<URL | null> {
        try {
            return await this.delivery.resolveTarget(url, this.connections.publicOrigin() !== null)
        } catch (error) {
            if (!(error instanceof WebhookDeliveryError)) throw error
            this.logger.warn(WebhookConnectionsLogEvent.DeliveryRefused, { connectionId: connection.id })
            await this.connections.patch(connection.workspaceId, connection.id, { lastError: error.code })
            return null
        }
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
