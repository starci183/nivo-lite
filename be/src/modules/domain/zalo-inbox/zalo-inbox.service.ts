import { InjectEntityInbox } from "@modules/platform/inbox"
import type { EntityInbox } from "@modules/platform/inbox"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import type { PolledZaloIntake, PolledZaloMessage, ZaloRawDelivery } from "./zalo-inbox.contracts"
import { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"
import type { ZaloDeliveryRecorded } from "@modules/queues/zalo-delivery"
import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { ZaloWebhookGateService } from "@modules/domain/channels"
import { ConversationsService, readZaloEvent } from "@modules/domain/conversations"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { zaloDeliveryIdOf } from "./zalo-delivery-id.policy"
import { polledRawBody } from "./zalo-poll.policy"
import { ZaloInboxEntity } from "./persistence/entities"

@Injectable()
/** Claims each Zalo message once, then publishes its durable receipt; a deferred consumer stores it and queues its answer. */
export class ZaloInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly conversations: ConversationsService,
        private readonly inboundEvents: InboundEventsService,
        @InjectEntityInbox() private readonly inbox: EntityInbox,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly gate: ZaloWebhookGateService,
    ) {}

    /** A redelivered message is acknowledged without being processed again; every event type has its own id, so a follow event is claimed once and never overwrites another. */
    acceptZaloDelivery(rawBody: ZaloRawDelivery, connection: string): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const receipt = await this.claim(manager, connection, rawBody, undefined)
            if (receipt === undefined) return
            // A connection that holds no OA secret key yet proved nothing: the call is acknowledged and closed, never read as an event.
            if (!(await this.gate.holdsProofKey(connection))) {
                await manager.update(ZaloInboxEntity, { id: receipt.id }, { processedAt: () => "now()", state: "handled" })
                return
            }
            await this.queueConsumer(manager, receipt.deliveryId)
        })
    }

    /**
     * Stores a customer message the reconcile job read back from Zalo, as the row the webhook would have made for it (the same delivery id, so a
     * message the webhook already delivered is a no-op). A fresh message follows the webhook road to its answer; a stale one is closed as
     * `expired` and kept for the owner, and no agent answers it. Answers true when the message was new to the inbox.
     */
    acceptPolledMessage(connection: string, message: PolledZaloMessage, intake: PolledZaloIntake): Promise<boolean> {
        return this.entityManager.transaction(async (manager) => {
            const receipt = await this.claim(manager, connection, polledRawBody(message), "poll")
            if (receipt === undefined) return false
            if (!intake.stale) {
                await this.queueConsumer(manager, receipt.deliveryId)
                return true
            }
            await manager.update(ZaloInboxEntity, { id: receipt.id }, { processedAt: () => "now()", state: "expired" })
            await this.inboundEvents.keepForOwner(manager, {
                workspaceId: intake.workspaceId,
                channel: "zalo",
                sender: intake.sender,
                body: message.text,
                eventId: `zalo:${connection}:${message.messageId}`,
            })
            return true
        })
    }

    /**
     * Resolves and processes a committed receipt atomically; retries leave a failed receipt pending. A message that went to an agent turn or to the
     * person who owns its conversation is `handled`; one that was only kept (nobody is bound to answer) stays `received`; an attempt that threw is
     * marked `failed` before the error goes back to the queue.
     */
    async processRecordedDelivery(message: ZaloDeliveryRecorded): Promise<void> {
        await this.entityManager
            .transaction((manager) => this.process(manager, message))
            .catch(async (cause: unknown) => {
                await this.entityManager.update(
                    ZaloInboxEntity,
                    { provider: "zalo", deliveryId: message.deliveryId, processedAt: IsNull() },
                    { state: "failed" },
                )
                throw cause
            })
    }

    private async process(manager: EntityManager, message: ZaloDeliveryRecorded): Promise<void> {
        const pending = await manager.findOne(ZaloInboxEntity, {
            where: { provider: "zalo", deliveryId: message.deliveryId, processedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
        })
        if (pending === null) return
        const rawBody = Buffer.from(pending.payload.rawBody, "utf8")
        const inbound = readZaloEvent(rawBody)
        const answered =
            inbound.kind === "ok"
                ? await this.conversations.acceptZalo(pending.payload.connection, inbound.value, manager)
                : true
        await manager.update(
            ZaloInboxEntity,
            { id: pending.id },
            { processedAt: () => "now()", state: answered ? "handled" : "received" },
        )
    }

    /** Claims the row of a delivery under its id; undefined when the id was taken (a redelivery, or the other door brought it first). */
    private async claim(
        manager: EntityManager,
        connection: string,
        rawBody: ZaloRawDelivery,
        source: "poll" | undefined,
    ): Promise<{ readonly id: string; readonly deliveryId: string } | undefined> {
        const payload = {
            connection,
            rawBody: rawBody?.toString("utf8") ?? "",
            ...(source === undefined ? {} : { source }),
        }
        const deliveryId = rawBody === undefined ? "" : zaloDeliveryIdOf(connection, rawBody)
        if (deliveryId === "") return undefined
        const receipt = {
            entity: ZaloInboxEntity,
            row: (id: string) => ({ provider: "zalo", deliveryId: id, payload }),
        }
        const id = await this.inbox.claimRow("zalo", deliveryId, manager, receipt)
        return id === undefined ? undefined : { id, deliveryId }
    }

    private async queueConsumer(manager: EntityManager, deliveryId: string): Promise<void> {
        const message: ZaloDeliveryRecorded = { deliveryId }
        await this.outbox.write(manager, ZALO_DELIVERY_QUEUE, message, { dedupeKey: `${ZALO_DELIVERY_QUEUE}:${deliveryId}` })
    }
}
