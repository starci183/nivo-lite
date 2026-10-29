import { createHash } from "node:crypto"
import { InjectEntityInbox } from "@modules/platform/inbox"
import type { EntityInbox } from "@modules/platform/inbox"
import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { ConnectionsService } from "@modules/domain/connections"
import { ConversationsService } from "@modules/domain/conversations"
import { MetaCommentsService } from "@modules/domain/meta-comments"
import { MetaThreadsService } from "@modules/domain/meta-threads"
import { MetaReceiptPolicy } from "./meta-receipt.policy"
import type { MetaEvent } from "@modules/integrations/meta"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder, isRecord, parseJsonText } from "@modules/platform/primitives"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { isMetaInboundJob, META_INBOUND_QUEUE, META_DELIVERY_QUEUE } from "./meta-inbox.contracts"
import { InjectMetaEventTaker } from "./meta-inbox.decorators"
import type { MetaEventTaker } from "./meta-inbox.port"
import type { DeliverySignature, MetaDeliveryRecorded, MetaInboundJob, RawDelivery } from "./meta-inbox.contracts"
import { MetaInboxEntity } from "./persistence/entities"

@Injectable()
/**
 * Records signed Meta receipts and their outbox messages atomically. A deferred consumer opens messaging windows,
 * records connected Page events and queues downstream handlers after the receipt has committed.
 */
export class MetaInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly receipts: MetaReceiptPolicy,
        @InjectEntityInbox() private readonly inbox: EntityInbox,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly connections: ConnectionsService,
        private readonly conversations: ConversationsService,
        private readonly threads: MetaThreadsService,
        private readonly comments: MetaCommentsService,
        @InjectMetaEventTaker() private readonly taker: MetaEventTaker,
    ) {}

    /** Records the signed receipt and its typed handoff atomically without processing business events. */
    accept(rawBody: RawDelivery, signature: DeliverySignature): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const read = parseJsonText(rawBody?.toString("utf8") ?? "")
            const decoded = {
                valid: read.ok && isRecord(read.value) && !Array.isArray(read.value),
                payload: read.ok && isRecord(read.value) && !Array.isArray(read.value) ? read.value : {},
            }
            const deliveryId =
                rawBody === undefined || signature === undefined || !decoded.valid
                    ? ""
                    : createHash("sha256").update(rawBody).digest("hex")
            if (
                !(await this.inbox.claimRow("meta", deliveryId, manager, {
                    entity: MetaInboxEntity,
                    row: { provider: "meta", deliveryId, payload: decoded.payload },
                }))
            )
                return
            const message: MetaDeliveryRecorded = { deliveryId }
            await this.outbox.write(manager, META_DELIVERY_QUEUE, message, {
                dedupeKey: `${META_DELIVERY_QUEUE}:${deliveryId}`,
            })
        })
    }

    /** Processes the pending receipt after commit; the row lock and completion protect against replay. */
    processRecordedDelivery(message: MetaDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const pending = await manager.findOne(MetaInboxEntity, {
                select: { id: true, payload: true },
                where: { provider: "meta", deliveryId: message.deliveryId, processedAt: IsNull() },
                lock: { mode: "pessimistic_write" },
            })
            if (pending === null) return
            await this.process(this.receipts.parse(pending.payload), manager)
            await manager.update(MetaInboxEntity, { id: pending.id }, { processedAt: () => "now()" })
        })
    }

    /**
     * Delivers the event a claimed job carries: the taker (the lead generation flow) first, else the chatbot front
     * door; a payload that
     * is not a queued Meta event is left alone.
     */
    async deliverPayload(payload: object): Promise<void> {
        if (!isMetaInboundJob(payload)) return
        if (await this.taker.take(payload)) return
        await this.deliver(payload)
    }

    /**
     * Hands one queued event to the conversation of its customer: a direct message is stored and answered by the
     * front-door agent bound
     * to the connection (in one transaction with its chat-turn job). Postbacks, comments, mentions and lead ads are
     * the business of the
     * lead-flow lanes and are left alone here.
     */
    async deliver(job: MetaInboundJob): Promise<void> {
        const { event } = job
        const person = event.sender_psid ?? event.sender_igsid
        if (event.kind !== "dm" || person === null || event.text === null || event.text === "") return
        await this.entityManager.transaction((manager) =>
            this.conversations.acceptMeta(
                job.connectionId,
                {
                    platform: event.platform,
                    personId: person,
                    visitor: event.sender_name,
                    text: event.text ?? "",
                    eventId: event.event_key,
                },
                manager,
            ),
        )
    }

    private process(events: ReadonlyArray<MetaEvent>, manager: EntityManager): Promise<void> {
        return eachInOrder(events, (event) => this.processOne(event, manager))
    }

    private async processOne(event: MetaEvent, manager: EntityManager): Promise<void> {
        const key = event.platform === "facebook" ? "page_id" : "ig_id"
        const ownerId = event.platform === "facebook" ? event.page_id : event.ig_id
        const owner = ownerId === null ? null : await this.connections.findLiveByMeta("meta", key, ownerId, manager)
        if (owner === null) return
        const at = new Date(event.timestamp).toISOString()
        const person = event.sender_psid ?? event.sender_igsid
        if ((event.kind === "dm" || event.kind === "postback") && person !== null) {
            await this.threads.touch({ connectionId: owner.id, platform: event.platform, userId: person, at }, manager)
        }
        if ((event.kind === "comment" || event.kind === "mention") && event.comment_id !== null) {
            await this.comments.note(
                { connectionId: owner.id, commentId: event.comment_id, platform: event.platform, at },
                manager,
            )
        }
        await this.connections.recordEvent(
            owner.id,
            {
                amount: 0,
                content: event.sender_name ?? event.kind,
                at,
                text: (event.text ?? "").slice(0, 160),
            },
            manager,
        )
        const job: MetaInboundJob = { connectionId: owner.id, workspaceId: owner.workspaceId, event }
        await this.outbox.write(manager, META_INBOUND_QUEUE, job, {
            dedupeKey: `${META_INBOUND_QUEUE}:${owner.id}:${event.event_key}`,
        })
    }
}
