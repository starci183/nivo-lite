import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsService } from "@modules/domain/connections"
import { ConversationsService } from "@modules/domain/conversations"
import { InjectMetaClient } from "@modules/integrations/meta"
import type { MetaClient, MetaEvent } from "@modules/integrations/meta"
import { acceptWebhookDelivery, InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder, isRecord, parseJsonText } from "@modules/platform/primitives"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { isMetaInboundJob, META_INBOUND_QUEUE } from "./meta-inbox.contracts"
import type { DeliverySignature, MetaInboundJob, RawDelivery } from "./meta-inbox.contracts"
import { MetaInboxError, MetaInboxErrorCode } from "./errors/meta-inbox.error"
import {
    COMPLETE_META_INBOX,
    INSERT_META_INBOX,
    NOTE_META_COMMENT,
    TOUCH_META_THREAD,
} from "./persistence/meta-inbox.sql"

@Injectable()
/**
 * Accepts one signed Meta delivery. The signature is checked against the raw body, the delivery is claimed once (a redelivery is
 * acknowledged without running again), and in the same transaction each event of a connected Page opens its messaging window or
 * private-reply window, marks the connection as working, and is queued for the handlers that answer it.
 */
export class MetaInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMetaClient() private readonly meta: MetaClient,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly connections: ConnectionsService,
        private readonly conversations: ConversationsService,
    ) {}

    /** Verifies and records the delivery; a delivery that carries no event of ours is acknowledged and dropped. */
    async accept(rawBody: RawDelivery, signature: DeliverySignature): Promise<void> {
        if (rawBody === undefined || !this.meta.verifyDelivery(signature, rawBody)) {
            throw new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid })
        }
        const read = parseJsonText(rawBody.toString("utf8"))
        if (!read.ok || !isRecord(read.value)) return
        const body = read.value
        const events = this.meta.parse(body)
        if (events.length === 0) return
        await acceptWebhookDelivery({
            entityManager: this.entityManager,
            insert: INSERT_META_INBOX,
            complete: COMPLETE_META_INBOX,
            provider: "meta",
            deliveryId: createHash("sha256").update(rawBody).digest("hex"),
            payload: body,
            process: (manager) => this.process(events, manager),
        })
    }

    /** Delivers the event a claimed job carries; a payload that is not a queued Meta event is left alone. */
    async deliverPayload(payload: object): Promise<void> {
        if (isMetaInboundJob(payload)) await this.deliver(payload)
    }

    /**
     * Hands one queued event to the conversation of its customer: a direct message is stored and answered by the front-door agent bound
     * to the connection (in one transaction with its chat-turn job). Postbacks, comments, mentions and lead ads are the business of the
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
            await manager.query(TOUCH_META_THREAD, [owner.id, event.platform, person, at])
        }
        if ((event.kind === "comment" || event.kind === "mention") && event.comment_id !== null) {
            await manager.query(NOTE_META_COMMENT, [owner.id, event.comment_id, event.platform, at])
        }
        await this.connections.recordEvent(owner.id, {
            amount: 0,
            content: event.sender_name ?? event.kind,
            at,
            text: (event.text ?? "").slice(0, 160),
        })
        const job: MetaInboundJob = { connectionId: owner.id, workspaceId: owner.workspaceId, event }
        await this.outbox.write(manager, META_INBOUND_QUEUE, job, {
            dedupeKey: `${META_INBOUND_QUEUE}:${owner.id}:${event.event_key}`,
        })
    }
}
