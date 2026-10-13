import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    WEBHOOK_DELIVERY_CLIENT,
    WebhookDeliveryError,
    WebhookDeliveryErrorCode,
} from "@modules/integrations/webhook-delivery"
import type { WebhookDeliveryClient } from "@modules/integrations/webhook-delivery"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { N8N_QUEUE } from "@modules/queues/n8n"
import type { N8nWebhookPayload } from "@modules/queues/n8n"
import { WebhookConnectionsError, WebhookConnectionsErrorCode } from "./errors/webhook-connections.error"
import { WEBHOOK_CONNECTIONS_OPTIONS } from "./webhook-connections.decorators"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"
import { signDelivery, workspaceSigningSecret } from "./webhook-signing.policy"
import { WebhookEventsService } from "./webhook-events.service"

const NOW = new Date("2026-10-13T03:00:00.000Z")
const TARGET = "https://receiver.test/hook"
const OPTIONS: WebhookConnectionsOptions = { engineSharedSecret: new Secret("engine-secret") }
const SIGNING_OFF: WebhookConnectionsOptions = { engineSharedSecret: undefined }
const DATA = { work_item_id: "wi-1", outcome: "approved" }
const JOB: N8nWebhookPayload = {
    workspaceId: "ws-1",
    connectionId: "c1",
    deliveryId: "c1:decision.made:wi-1:approved",
    event: "decision.made",
    data: DATA,
    occurredAtMs: NOW.getTime(),
}

const PUBLICATION = {
    workspaceId: "ws-1",
    event: "decision.made",
    data: DATA,
    dedupe: "decision.made:wi-1:approved",
} as const

const record = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "c1",
    workspaceId: "ws-1",
    provider: "webhook",
    name: "n8n",
    meta: { host: "receiver.test", events: "decision.made,lead.created" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.listByProvider.mockResolvedValue([
        record(),
        record({ id: "c2", meta: { events: "lead.created" } }),
        record({ id: "c3", status: "pending" }),
    ])
    connections.find.mockResolvedValue(record())
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify({ url: TARGET }), webhookSecret: "s" })
    connections.publicOrigin.mockReturnValue("https://nivo.vn")
    connections.patch.mockResolvedValue(undefined)
    const delivery = mock<WebhookDeliveryClient>()
    delivery.resolveTarget.mockResolvedValue(new URL(TARGET))
    delivery.post.mockResolvedValue({ status: 200, failure: null, durationMs: 12 })
    const outbox = recordingQueueOutbox()
    const logger = mock<Logger>()
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebhookEventsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: WEBHOOK_DELIVERY_CLIENT, useValue: delivery },
            { provide: WEBHOOK_CONNECTIONS_OPTIONS, useValue: OPTIONS },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    return { service: moduleRef.get(WebhookEventsService), connections, delivery, outbox }
}

/** The service on a deployment without a signing key: every other collaborator is an empty double. */
const buildWithoutSigning = async () => {
    const outbox = recordingQueueOutbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebhookEventsService,
            { provide: WEBHOOK_CONNECTIONS_OPTIONS, useValue: SIGNING_OFF },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: WEBHOOK_DELIVERY_CLIENT, useValue: mock<WebhookDeliveryClient>() },
            { provide: ConnectionsService, useValue: mock<ConnectionsService>() },
        ],
    }).compile()
    return { service: moduleRef.get(WebhookEventsService), outbox }
}

describe("WebhookEventsService", () => {
    describe("publish", () => {
        it("queues one delivery per connected webhook that picked the event, keyed by connection and occurrence", async () => {
            const { service, outbox } = await build()

            await expect(service.publish(PUBLICATION)).resolves.toBeUndefined()

            expect(outbox.jobs).toEqual([{ queue: N8N_QUEUE, payload: JOB }])
        })

        it("queues nothing while signing is off", async () => {
            const { service, outbox } = await buildWithoutSigning()

            await service.publish(PUBLICATION)

            expect(outbox.jobs).toEqual([])
        })
    })

    describe("deliver", () => {
        it("posts the signed event with the delivery id and the occurrence timestamp", async () => {
            const { service, delivery } = await build()

            await expect(service.deliver(JOB)).resolves.toBeUndefined()

            const body = JSON.stringify({
                id: JOB.deliveryId,
                event: "decision.made",
                workspace_id: "ws-1",
                occurred_at: NOW.toISOString(),
                data: DATA,
            })
            const timestamp = String(NOW.getTime())
            const key = workspaceSigningSecret("engine-secret", "ws-1")
            expect(delivery.post.mock.calls).toEqual([
                [
                    {
                        url: new URL(TARGET),
                        body,
                        headers: {
                            "x-nivo-event": "decision.made",
                            "x-nivo-delivery": JOB.deliveryId,
                            "x-nivo-timestamp": timestamp,
                            "x-nivo-signature": signDelivery(key, timestamp, body),
                        },
                    },
                ],
            ])
        })

        it("throws a retryable failure when the receiver is down", async () => {
            const { service, delivery } = await build()
            delivery.post.mockResolvedValue({ status: null, failure: "timeout", durationMs: 10_000 })

            await expect(service.deliver(JOB)).rejects.toEqual(
                new WebhookConnectionsError({
                    code: WebhookConnectionsErrorCode.DeliveryFailed,
                    params: { status: "none" },
                }),
            )
        })

        it("records a 4xx answer on the connection and does not retry", async () => {
            const { service, delivery, connections } = await build()
            delivery.post.mockResolvedValue({ status: 410, failure: null, durationMs: 9 })

            await expect(service.deliver(JOB)).resolves.toBeUndefined()

            expect(connections.patch.mock.calls).toEqual([["ws-1", "c1", { lastError: "HTTP 410" }]])
        })

        it("records an address NIVO may not call and posts nothing", async () => {
            const { service, delivery, connections } = await build()
            delivery.resolveTarget.mockRejectedValue(
                new WebhookDeliveryError({ code: WebhookDeliveryErrorCode.TargetRefused }),
            )

            await expect(service.deliver(JOB)).resolves.toBeUndefined()

            expect(delivery.post.mock.calls).toEqual([])
            expect(connections.patch.mock.calls).toEqual([
                ["ws-1", "c1", { lastError: WebhookDeliveryErrorCode.TargetRefused }],
            ])
        })

        it("drops the delivery of a connection that was switched off", async () => {
            const { service, delivery, connections } = await build()
            connections.find.mockResolvedValue(record({ status: "disconnected" }))

            await expect(service.deliver(JOB)).resolves.toBeUndefined()

            expect(delivery.post.mock.calls).toEqual([])
        })
    })
})
