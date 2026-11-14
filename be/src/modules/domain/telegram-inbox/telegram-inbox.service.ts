import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import {
    type TelegramDeliveryRecorded,
    type TelegramMessageRead,
    type TelegramRawDelivery,
    TELEGRAM_DELIVERY_QUEUE,
} from "./telegram-inbox.contracts"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AccountDataIntakeService, scopedDeliveryIdOf, type PendingRow } from "@modules/domain/account-data"
import { CustomerFilesService } from "@modules/domain/chat-files"
import { ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ProviderTriggersService, type CanonicalEvent } from "@modules/domain/provider-triggers"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { telegramUpdate } from "./telegram.data-types"
import { telegramMessageRowsOf, telegramUpdateRowsOf } from "./telegram.normalise.policy"
import { TelegramFilesService } from "./telegram-files.service"
import { TelegramInboxLogEvent } from "./telegram-inbox.log-events"
import { TELEGRAM_MESSAGE_WEBHOOK, type TelegramMessageData, type TelegramUpdateRow } from "./telegram-message.trigger"

/** The name a person with no name on Telegram is kept under for the owner, as the channel shows it. */
const GUEST = "Telegram"

/** The message of a stored update as the account keeps it beside the update. */
const messageReadOf = (row: TelegramUpdateRow, event: CanonicalEvent<TelegramMessageData>): TelegramMessageRead => {
    const message = row.raw.message
    const id = typeof message === "object" && message !== null && "message_id" in message ? message.message_id : Number.NaN
    return {
        chatId: event.subject?.id ?? "",
        messageId: typeof id === "number" ? id : Number.NaN,
        text: event.data.text,
        sentAt: event.data.at === null ? null : Date.parse(event.data.at),
    }
}

@Injectable()
/**
 * THE TELEGRAM BOT'S ENTRY (the adapter stage of the one event pipeline, concept triggers rule 13). Writes each Telegram update the chat
 * answers once as a `telegram.update` row of its connection's account (the INBOX: its unique key is the dedupe) and publishes its durable
 * receipt in the same transaction. The deferred consumer runs the provider's pure `translate` on the stored row, VERIFIES the connection,
 * asks Telegram for the address of each picture with the bot (`getFile`) and keeps the bytes in the shop's store, hands the canonical event
 * to the ONE delivery function, keeps the message and the person for the account and completes the update. It meets nobody and wakes
 * nobody itself; `/start` is a message like any other.
 */
export class TelegramInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly files: TelegramFilesService,
        private readonly intake: AccountDataIntakeService,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly connections: ConnectionsService,
        private readonly customerFiles: CustomerFilesService,
        private readonly inboundEvents: InboundEventsService,
        private readonly triggers: ProviderTriggersService,
    ) {}

    /** A redelivered update is acknowledged without being processed again; an update the chat does not answer, or one for a connection nobody holds, is acknowledged and dropped. */
    acceptTelegramDelivery(rawBody: TelegramRawDelivery, connection: string): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            if (rawBody === undefined) return
            const rows = telegramUpdateRowsOf(rawBody)
            const [first] = rows
            const value = TELEGRAM_MESSAGE_WEBHOOK.raw.safeParse(first?.value)
            if (!value.success || TELEGRAM_MESSAGE_WEBHOOK.translate(value.data, { connectionId: connection }) === null) return
            const written = await this.intake.write(manager, connection, rows)
            if (written.owner === null) {
                this.logger.warn(TelegramInboxLogEvent.UnknownConnection, { connectionId: connection })
                return
            }
            const update = written.rows.find((row) => row.type === telegramUpdate.name)
            if (update?.isNew !== true) return
            const deliveryId = `${connection}:${update.key}`
            const message: TelegramDeliveryRecorded = { deliveryId }
            await this.outbox.write(manager, TELEGRAM_DELIVERY_QUEUE, message, {
                dedupeKey: `${TELEGRAM_DELIVERY_QUEUE}:${deliveryId}`,
            })
        })
    }

    /**
     * Processes a committed update atomically: delivers its message (translate, verify, keep the pictures, deliver), keeps the message and
     * the person beside it and completes the update; a throw leaves the update pending for the queue's retry, which delivers the same event id.
     */
    processRecordedDelivery(message: TelegramDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const scoped = scopedDeliveryIdOf(message.deliveryId)
            if (scoped === null) return
            const pending = await this.intake.lockPending(manager, telegramUpdate.name, scoped.connectionId, scoped.externalId)
            if (pending === null) return
            const read = await this.deliverMessage(manager, pending)
            if (read !== null) {
                await this.intake.write(manager, scoped.connectionId, telegramMessageRowsOf(pending.value.raw, read, this.clock.now()))
            }
            await this.intake.complete(manager, pending)
        })
    }

    /**
     * The message of a stored update, handed to the ONE delivery function; null (nothing kept beside it) for an update the chat does not
     * answer. A message no registered graph takes stays kept raw and is kept for the owner, as a message with no front door was.
     */
    private async deliverMessage(manager: EntityManager, pending: PendingRow): Promise<TelegramMessageRead | null> {
        const connectionId = pending.owner.connectionId
        const row = TELEGRAM_MESSAGE_WEBHOOK.raw.safeParse(pending.value)
        const event = row.success ? TELEGRAM_MESSAGE_WEBHOOK.translate(row.data, { connectionId }) : null
        if (!row.success || event === null) return null
        const connection = await this.connections.intakeOf(connectionId, "telegram", manager)
        if (connection.kind !== "ok") return messageReadOf(row.data, event)
        const workspaceId = connection.value.workspaceId
        const visitor = event.subject?.name ?? GUEST
        // As a Zalo OA: the first event turns a seeded (pending) bot connected and is kept for the wizard.
        await this.connections.markReceived(
            connectionId,
            { amount: 0, content: visitor, at: this.clock.now().toISOString(), text: event.data.text.slice(0, 160) },
            manager,
        )
        const addresses = await this.files.addressesOf(connectionId, event.data.attachments)
        const kept = await this.customerFiles.keep(workspaceId, event.data.messageKey, addresses)
        const delivered = await this.triggers.deliver(
            {
                workspaceId,
                declaration: TELEGRAM_MESSAGE_WEBHOOK,
                connectionId,
                agentId: null,
                events: [
                    {
                        event,
                        raw: { type: pending.type, id: pending.id },
                        ...(kept.length === 0 ? {} : { files: kept }),
                        ...(event.data.at === null ? {} : { occurredAt: event.data.at }),
                    },
                ],
            },
            manager,
        )
        if (delivered.status === "delivered" && delivered.untaken > 0) {
            await this.inboundEvents.keepUnrouted(manager, {
                workspaceId,
                channel: "telegram",
                sender: visitor,
                body: event.data.text,
                eventId: event.data.messageKey,
            })
        }
        return messageReadOf(row.data, event)
    }
}
