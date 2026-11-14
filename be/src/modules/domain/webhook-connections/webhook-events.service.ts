import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import { eachInOrder } from "@modules/platform/primitives"
import { N8N_QUEUE, N8N_WEBHOOK_JOB, isN8nWebhookPayload, type N8nWebhookPayload } from "@modules/queues/n8n"
import { WebhookConnectionsError, WebhookConnectionsErrorCode } from "./errors/webhook-connections.error"
import type { WebhookPublication } from "./webhook-connections.contracts"
import { InjectWebhookConnectionsOptions } from "./webhook-connections.decorators"
import { WebhookConnectionsLogEvent } from "./webhook-connections.log-events"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"
import { installedWebhookEvents } from "./webhook-events.catalogue"
import { WebhookSendRegistryService } from "./webhook-send-registry.service"
import type { WebhookSendResult } from "./webhook-send.port"
import { deliveryVerdict, eventsOf, signDelivery, workspaceSigningSecret } from "./webhook-signing.policy"

@Injectable()
/**
 * The business events leaving NIVO through the webhook connections: every connected webhook of the workspace that picked the event
 * gets one signed delivery job (once per connection and occurrence), and the job posts it with the per-workspace signing key and
 * the same headers and signature as the wizard's test, through the account's outgoing webhook port (`portFor`: the receiver of a live
 * account, the hardcoded cases of a sandbox one).
 */
export class WebhookEventsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectWebhookConnectionsOptions() private readonly options: WebhookConnectionsOptions,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly connections: ConnectionsService,
        private readonly sends: WebhookSendRegistryService,
    ) {}

    /**
     * Queues the event for every connected webhook of the workspace that picked it, inside the caller's transaction when it hands
     * one. `dedupe` names the occurrence: publishing it twice queues nothing twice. Nothing is queued while signing is off.
     */
    async publish(publication: WebhookPublication, manager: EntityManager = this.entityManager): Promise<void> {
        if (this.options.signingSecret === undefined) return
        const { workspaceId, event, data, dedupe } = publication
        const available = installedWebhookEvents().map((option) => option.id)
        const subscribed = (
            await this.connections.listByProvider(workspaceId, "webhook", { includeDisconnected: false })
        ).filter((connection) => connection.status === "connected" && eventsOf(connection.meta, available).includes(event))
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
        if (connection?.status !== "connected" || shared === undefined) {
            this.logger.warn(WebhookConnectionsLogEvent.DeliveryDropped, { connectionId: job.connectionId })
            return
        }
        const body = JSON.stringify({
            id: job.deliveryId,
            event: job.event,
            workspace_id: job.workspaceId,
            occurred_at: new Date(job.occurredAtMs).toISOString(),
            data: job.data,
        })
        const timestamp = String(job.occurredAtMs)
        const key = workspaceSigningSecret(shared.reveal(), job.workspaceId)
        const result = await this.post(connection, {
            body,
            headers: {
                "x-nivo-event": job.event,
                "x-nivo-delivery": job.deliveryId,
                "x-nivo-timestamp": timestamp,
                "x-nivo-signature": signDelivery(key, timestamp, body),
            },
        })
        if (result === null) return
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

    /**
     * Posts one signed delivery through the account's port. An account holding no address is dropped (logged); an address that cannot be
     * a delivery target is recorded on the connection and not retried. Either way the answer is null; so is it when the app composed no port for the provider (a wiring defect, logged).
     */
    private async post(
        connection: ConnectionRecord,
        request: { readonly body: string; readonly headers: Readonly<Record<string, string>> },
    ): Promise<WebhookSendResult | null> {
        const port = this.sends.portFor(connection)
        if (port === undefined) {
            this.logger.warn(WebhookConnectionsLogEvent.DeliveryDropped, { connectionId: connection.id })
            return null
        }
        try {
            return await port.post(connection, request)
        } catch (error) {
            if (!(error instanceof WebhookConnectionsError)) throw error
            if (error.code === WebhookConnectionsErrorCode.NoUrl) {
                this.logger.warn(WebhookConnectionsLogEvent.DeliveryDropped, { connectionId: connection.id })
                return null
            }
            if (error.code !== WebhookConnectionsErrorCode.UrlRefused) throw error
            this.logger.warn(WebhookConnectionsLogEvent.DeliveryRefused, { connectionId: connection.id })
            const cause = error.cause
            const reason = cause instanceof DomainError ? cause.code : error.code
            await this.connections.patch(connection.workspaceId, connection.id, { lastError: reason })
            return null
        }
    }
}
