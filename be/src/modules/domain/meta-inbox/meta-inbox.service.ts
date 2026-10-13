import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsService } from "@modules/domain/connections"
import { InjectMetaClient } from "@modules/integrations/meta"
import type { MetaClient, MetaEvent } from "@modules/integrations/meta"
import { acceptWebhookDelivery, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { META_INBOUND_QUEUE } from "./meta-inbox.contracts"
import type { MetaInboundJob } from "./meta-inbox.contracts"
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
    ) {}

    /** Verifies and records the delivery; a delivery that carries no event of ours is acknowledged and dropped. */
    async accept(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
        if (rawBody === undefined || !this.meta.verifyDelivery(signature, rawBody)) {
            throw new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid })
        }
        const body = this.readJson(rawBody)
        const events = this.meta.parse(body)
        if (events.length === 0) return
        await acceptWebhookDelivery({
            entityManager: this.entityManager,
            insert: INSERT_META_INBOX,
            complete: COMPLETE_META_INBOX,
            provider: "meta",
            deliveryId: createHash("sha256").update(rawBody).digest("hex"),
            payload: body as object,
            process: (manager) => this.process(events, manager),
        })
    }

    private readJson(rawBody: Buffer): unknown {
        try {
            return JSON.parse(rawBody.toString("utf8"))
        } catch {
            return null
        }
    }

    private async process(events: ReadonlyArray<MetaEvent>, manager: EntityManager): Promise<void> {
        for (const event of events) {
            const key = event.platform === "facebook" ? "page_id" : "ig_id"
            const ownerId = event.platform === "facebook" ? event.page_id : event.ig_id
            const owner = ownerId === null ? null : await this.connections.findLiveByMeta("meta", key, ownerId, manager)
            if (owner === null) continue
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
}
