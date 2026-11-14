import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import type { PolledZaloIntake, PolledZaloMessage, ZaloEventSource, ZaloRawDelivery } from "./zalo-inbox.contracts"
import { ZALO_DELIVERY_QUEUE, type ZaloDeliveryRecorded } from "@modules/queues/zalo-delivery"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
    AccountDataIntakeService,
    AccountDataReadService,
    scopedDeliveryIdOf,
    type AccountDataInput,
    type PendingRow,
} from "@modules/domain/account-data"
import { ZaloCredentialsService, ZaloWebhookGateService } from "@modules/domain/channels"
import { CustomerFilesService } from "@modules/domain/chat-files"
import { ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { ZALO_MESSAGE_TRIGGER, zaloAppIdOf, type ZaloMessageData } from "@modules/domain/zalo-provider"
import type { CanonicalEvent } from "@modules/domain/provider-triggers"
import { zaloEventNameOf } from "@modules/integrations/zalo"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder, isRecord } from "@modules/platform/primitives"
import { zaloEvent, zaloUser } from "./zalo.data-types"
import { mergedZaloUserOf, zaloBodyOf, zaloDerivedRowsOf, zaloEventRowsOf, zaloRawOf } from "./zalo.normalise.policy"
import { ZaloInboxLogEvent } from "./zalo-inbox.log-events"
import { polledRawBody } from "./zalo-polled-body.policy"

/** The key of a new event row, or undefined when nothing was written (a redelivery, a connection nobody holds). */
type OptionalNewKey = string | undefined

/** The language of the guest label a person with no name is kept under for the owner: the shop's owners read it in Vietnamese. */
const LOCALE = "vi"

/** Queues the consumer that processes a committed event. */
const queueConsumer = (outbox: QueueOutbox, manager: EntityManager, deliveryId: string): Promise<void> => {
    const message: ZaloDeliveryRecorded = { deliveryId }
    return outbox.write(manager, ZALO_DELIVERY_QUEUE, message, { dedupeKey: `${ZALO_DELIVERY_QUEUE}:${deliveryId}` })
}

@Injectable()
/**
 * THE ZALO OA'S ENTRY (the adapter stage of the one event pipeline, concept triggers rule 13). Writes each Zalo event once as a
 * `zalo_oa.event` row of its connection's account (the INBOX: its unique key is the dedupe; the webhook and the poll bring the same key for
 * one customer message, so whichever comes first is the one row) and publishes its durable receipt in the same transaction. The deferred
 * consumer VERIFIES the event (a live Zalo connection, the OA's own app), runs the provider's pure `translate` on the stored row, keeps the
 * customer's pictures (their Zalo address expires) and hands the canonical event to the ONE delivery function; it keeps the message and the
 * person for the account and completes the row. It meets nobody and wakes nobody itself.
 */
export class ZaloInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly inboundEvents: InboundEventsService,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly gate: ZaloWebhookGateService,
        private readonly intake: AccountDataIntakeService,
        private readonly reads: AccountDataReadService,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly connections: ConnectionsService,
        private readonly credentials: ZaloCredentialsService,
        private readonly files: CustomerFilesService,
        private readonly triggers: ProviderTriggersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /**
     * A redelivered event is acknowledged without being processed again. A connection that holds no OA secret key yet proved nothing: its
     * event is written and completed at once, never queued.
     */
    async acceptZaloDelivery(rawBody: ZaloRawDelivery, connection: string): Promise<void> {
        const isProven = await this.gate.holdsProofKey(connection)
        return this.entityManager.transaction(async (manager) => {
            if (rawBody === undefined) return
            const key = await this.receive(manager, connection, rawBody, undefined)
            if (key === undefined) return
            if (!isProven) {
                await this.completeNow(manager, connection, key)
                return
            }
            await queueConsumer(this.outbox, manager, `${connection}:${key}`)
        })
    }

    /**
     * Writes a customer message the reconcile job read back from Zalo as the event the webhook would have made of it (the same key, so a
     * message the webhook already delivered is a no-op). A fresh message follows the webhook road to its answer; a stale one is completed at
     * once, kept for the owner and for the account, and no agent answers it. Answers true when the message was new to the account.
     */
    acceptPolledMessage(connection: string, message: PolledZaloMessage, intake: PolledZaloIntake): Promise<boolean> {
        return this.entityManager.transaction(async (manager) => {
            const rawBody = polledRawBody(message)
            const key = await this.receive(manager, connection, rawBody, "poll")
            if (key === undefined) return false
            if (!intake.stale) {
                await queueConsumer(this.outbox, manager, `${connection}:${key}`)
                return true
            }
            await this.completeNow(manager, connection, key)
            await this.inboundEvents.keepForOwner(manager, {
                workspaceId: intake.workspaceId,
                channel: "zalo",
                sender: intake.sender,
                body: message.text,
                eventId: `zalo:${connection}:${message.messageId}`,
            })
            await this.keepDerived(manager, connection, zaloRawOf(rawBody), intake.sender)
            return true
        })
    }

    /**
     * Processes a committed event atomically: delivers its customer message (verify, translate, keep the pictures, deliver), keeps the
     * message and the person and completes the event. A throw leaves the event pending and goes back to the queue, which retries it; a retry
     * delivers the same event id, which the delivery keeps to one wake.
     */
    processRecordedDelivery(message: ZaloDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const scoped = scopedDeliveryIdOf(message.deliveryId)
            if (scoped === null) return
            const pending = await this.intake.lockPending(manager, zaloEvent.name, scoped.connectionId, scoped.externalId)
            if (pending === null) return
            await this.deliverMessage(manager, pending)
            await this.keepDerived(manager, scoped.connectionId, pending.value.raw, "")
            await this.intake.complete(manager, pending)
        })
    }

    /** Writes the event row of a delivery; the key of the row when it is new, undefined for a redelivery or a connection nobody holds. */
    private async receive(
        manager: EntityManager,
        connection: string,
        rawBody: Buffer,
        source: ZaloEventSource | undefined,
    ): Promise<OptionalNewKey> {
        const written = await this.intake.write(manager, connection, zaloEventRowsOf(rawBody, source))
        if (written.owner === null) {
            this.logger.warn(ZaloInboxLogEvent.UnknownConnection, { connectionId: connection })
            return undefined
        }
        const row = written.rows.find((entry) => entry.type === zaloEvent.name)
        return row?.isNew === true ? row.key : undefined
    }

    /** Completes a just-written event that nothing is owed on in the same transaction. */
    private async completeNow(manager: EntityManager, connection: string, key: string): Promise<void> {
        const pending = await this.intake.lockPending(manager, zaloEvent.name, connection, key)
        if (pending !== null) await this.intake.complete(manager, pending)
    }

    /** Keeps the message and the person an event names, the person over what the account already kept of them. */
    private async keepDerived(manager: EntityManager, connectionId: string, raw: unknown, name: string): Promise<void> {
        const rows: Array<AccountDataInput> = []
        await eachInOrder(zaloDerivedRowsOf(raw, this.clock.now(), name), async (row) => {
            rows.push(await this.overStoredUser(manager, connectionId, row))
        })
        if (rows.length > 0) await this.intake.write(manager, connectionId, rows)
    }

    /** A person's row over the one the account keeps of them; any other row as it is. */
    private async overStoredUser(
        manager: EntityManager,
        connectionId: string,
        row: AccountDataInput,
    ): Promise<AccountDataInput> {
        const value: unknown = row.value
        if (row.type !== zaloUser.name || !isRecord(value) || typeof value.userId !== "string") return row
        const stored = await this.reads.get(connectionId, zaloUser.name, value.userId, manager)
        return { type: row.type, value: mergedZaloUserOf(stored?.value ?? null, value) }
    }

    /**
     * The customer message of a stored event, handed to the ONE delivery function: the provider's pure translate of the row (an event the
     * chat does not answer is logged and closed), the connection proven live and of the OA's own app, the first event turning a pending
     * connection connected, the pictures kept in the shop's store under the line's key. A message no registered graph takes stays kept raw
     * and is kept for the owner, as a message with no front door was.
     */
    private async deliverMessage(manager: EntityManager, pending: PendingRow): Promise<void> {
        const connectionId = pending.owner.connectionId
        const row = ZALO_MESSAGE_TRIGGER.raw.safeParse(pending.value)
        const event = row.success ? ZALO_MESSAGE_TRIGGER.translate(row.data, { connectionId }) : null
        if (!row.success || event === null) {
            this.logger.info(ZaloInboxLogEvent.EventIgnored, {
                connectionId,
                eventName: zaloEventNameOf(zaloBodyOf(pending.value.raw)) ?? "unreadable",
                reason: "not_answered",
            })
            return
        }
        const connection = await this.connections.intakeOf(connectionId, "zalo_oa", manager)
        if (connection.kind !== "ok" || (await this.isOtherApp(connectionId, zaloAppIdOf(row.data.raw)))) return
        const workspaceId = connection.value.workspaceId
        const visitor = event.subject?.name ?? this.catalog.get("conversations.zaloGuest", {}, LOCALE)
        await this.connections.markReceived(
            connectionId,
            { amount: 0, content: visitor, at: this.clock.now().toISOString(), text: event.data.text.slice(0, 160) },
            manager,
        )
        const files = await this.files.keep(workspaceId, event.data.messageKey, event.data.attachments)
        const delivered = await this.triggers.deliver(
            {
                workspaceId,
                declaration: ZALO_MESSAGE_TRIGGER,
                connectionId,
                agentId: null,
                events: [
                    {
                        event,
                        raw: { type: pending.type, id: pending.id },
                        ...(files.length === 0 ? {} : { files }),
                        ...(event.data.at === null ? {} : { occurredAt: event.data.at }),
                    },
                ],
            },
            manager,
        )
        if (delivered.status === "delivered" && delivered.untaken > 0) await this.keepUntaken(manager, workspaceId, connectionId, visitor, event)
    }

    /** Keeps a message no registered graph took for the owner, as an unrouted channel message. */
    private keepUntaken(
        manager: EntityManager,
        workspaceId: string,
        connectionId: string,
        visitor: string,
        event: CanonicalEvent<ZaloMessageData>,
    ): Promise<void> {
        return this.inboundEvents.keepUnrouted(manager, {
            workspaceId,
            channel: "zalo",
            sender: visitor,
            body: event.data.text,
            eventId: `zalo:${connectionId}:${event.id}`,
        })
    }

    /** True when the event names a Zalo app other than the one the connection holds (an event for another OA app). */
    private async isOtherApp(connectionId: string, appId: string): Promise<boolean> {
        if (appId === "") return false
        const loaded = await this.credentials.load(connectionId)
        return loaded.kind === "ok" && loaded.value.secret.appId !== appId
    }
}
