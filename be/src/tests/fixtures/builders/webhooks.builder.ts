import { CLOCK } from "@modules/platform/clock"
import { Test } from "@nestjs/testing"
import { createHash, createHmac } from "node:crypto"
import { FakeClock, mock, type MockOf } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { ConversationsService } from "@modules/domain/conversations"
import { MetaCommentsService } from "@modules/domain/meta-comments"
import {
    MetaInboxErrorCode,
    MetaInboxService,
    MetaWebhookVerifierService,
    MetaReceiptPolicy,
} from "@modules/domain/meta-inbox"
import { MetaThreadsService } from "@modules/domain/meta-threads"
import { type MetaClient, META_CLIENT } from "@modules/integrations/meta"
import { QUEUE_OUTBOX, QueueOutboxService } from "@modules/platform/queue"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX, InboxService } from "@modules/platform/inbox"
import type { EntityManager } from "typeorm"
import { workspacesEntities } from "@modules/domain/workspaces"

const WorkspaceEntity: (typeof workspacesEntities)[0] = workspacesEntities[0]

/** Explicit identities and signing/queue options supplied by the test composition root. */
export interface WebhookBuilderOptions {
    readonly userId: string
    readonly workspaceId: string
    readonly connectionId: string
    readonly signingFixture: string
    readonly nextId: () => string
}

const signedDelivery = (options: WebhookBuilderOptions) => {
    const clock = new FakeClock("2026-10-14T00:00:00.000Z")
    return () => {
        const mid = `meta-proof-${options.nextId()}`
        const payload = {
            object: "page",
            entry: [
                {
                    id: "proof-page",
                    messaging: [
                        {
                            sender: { id: "proof-person" },
                            timestamp: clock.now().getTime(),
                            message: { mid, text: "Integration delivery" },
                        },
                    ],
                },
            ],
        }
        const rawBody = Buffer.from(JSON.stringify(payload))
        const deliveryId = createHash("sha256").update(rawBody).digest("hex")
        return {
            payload,
            mid,
            deliveryId,
            rawBody,
            signature: `sha256=${createHmac("sha256", options.signingFixture).update(rawBody).digest("hex")}`,
        }
    }
}

/** The door under test, its driver and the owners it talks to. */
type WebhooksBuilderReceiverShape = { receive: (rawBody: Buffer, signature: string) => Promise<void> }

type WebhooksBuilderSenderShape = { id: string }

type WebhooksBuilderDoorShape = {
    door: WebhooksBuilderReceiverShape
    process: (deliveryId: string) => Promise<void>
    close: () => Promise<void>
    connections: MockOf<ConnectionsService>
    conversations: MockOf<ConversationsService>
    threads: MockOf<MetaThreadsService>
}

type WebhooksBuilderMessageShape = { mid: string; text: string }

type WebhooksBuilderMessagingShape = {
    sender: WebhooksBuilderSenderShape
    timestamp: number
    message: WebhooksBuilderMessageShape
}

type WebhooksBuilderEntryShape = { id: string; messaging: Array<WebhooksBuilderMessagingShape> }

type WebhooksBuilderPayloadShape = {
    object: string
    entry: Array<WebhooksBuilderEntryShape>
}

type WebhooksBuilderDeliveryShape = {
    payload: WebhooksBuilderPayloadShape
    mid: string
    deliveryId: string
    rawBody: Buffer<ArrayBuffer>
    signature: string
}

type WebhooksBuilderBuildShape = {
    build: () => Promise<WebhooksBuilderDoorShape>
    delivery: () => WebhooksBuilderDeliveryShape
    connectionId: string
    workspaceId: string
    signatureInvalidCode: MetaInboxErrorCode
}

/** Persists the real workspace needed by the transactional inbox/outbox handoff. */
export const webhooksBuilder = (manager: EntityManager, meta: MetaClient, options: WebhookBuilderOptions) => ({
    async build(): Promise<WebhooksBuilderBuildShape> {
        const { userId, workspaceId, connectionId } = options
        await manager.transaction(async (tx) => {
            await tx.insert("auth.users", { id: userId })
            await tx.insert(WorkspaceEntity, { id: workspaceId, ownerId: userId, name: "Meta integration proof" })
        })
        const build = async () => {
            // The actual provider client verifies and parses; business effects are observed at their module boundaries.
            const connections = mock<ConnectionsService>()
            connections.findLiveByMeta.mockResolvedValue({ id: connectionId, workspaceId })
            connections.recordEvent.mockResolvedValue(null)
            const conversations = mock<ConversationsService>()
            const threads = mock<MetaThreadsService>()
            threads.touch.mockResolvedValue(undefined)
            const comments = mock<MetaCommentsService>()
            const outbox = new QueueOutboxService()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    MetaInboxService,
                    MetaReceiptPolicy,
                    { provide: CLOCK, useValue: new FakeClock("2026-10-14T00:00:00.000Z") },
                    { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
                    { provide: META_CLIENT, useValue: meta },
                    { provide: INBOX, useClass: InboxService },
                    { provide: QUEUE_OUTBOX, useValue: outbox },
                    { provide: ConnectionsService, useValue: connections },
                    { provide: ConversationsService, useValue: conversations },
                    { provide: MetaThreadsService, useValue: threads },
                    { provide: MetaCommentsService, useValue: comments },
                ],
            }).compile()
            const proofModule = await Test.createTestingModule({
                providers: [MetaWebhookVerifierService, { provide: META_CLIENT, useValue: meta }],
            }).compile()
            const inbox = moduleRef.get(MetaInboxService)
            const verifier = proofModule.get(MetaWebhookVerifierService)
            return {
                door: {
                    receive: async (rawBody: Buffer, signature: string) => {
                        verifier.verify(rawBody, signature)
                        await inbox.accept(rawBody, signature)
                    },
                },
                process: (deliveryId: string) => inbox.processRecordedDelivery({ deliveryId }),
                close: async () => {
                    await moduleRef.close()
                    await proofModule.close()
                },
                connections,
                conversations,
                threads,
            }
        }

        return {
            build,
            delivery: signedDelivery(options),
            connectionId,
            workspaceId,
            signatureInvalidCode: MetaInboxErrorCode.SignatureInvalid,
        }
    },
})
