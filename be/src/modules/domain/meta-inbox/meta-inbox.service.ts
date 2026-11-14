import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AccountDataIntakeService, AccountDataReadService, scopedDeliveryIdOf } from "@modules/domain/account-data"
import { ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { MetaCommentsService } from "@modules/domain/meta-comments"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { MetaThreadsService } from "@modules/domain/meta-threads"
import { MetaReceiptPolicy } from "./meta-receipt.policy"
import type { MetaEvent } from "@modules/integrations/meta"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder, isRecord, parseJsonText } from "@modules/platform/primitives"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import { MetaInboxError, MetaInboxErrorCode } from "./errors/meta-inbox.error"
import { MetaInboxLogEvent } from "./meta-inbox.log-events"
import {
    isMetaInboundJob,
    META_INBOUND_QUEUE,
    META_DELIVERY_QUEUE,
    type DeliverySignature,
    type MetaDeliveryOutcome,
    type MetaDeliveryRecorded,
    type MetaInboundJob,
    type MetaSurfaceOwner,
    type OptionalMetaSurfaceOwner,
    type RawDelivery,
} from "./meta-inbox.contracts"
import { distinctSurfacesOf, isMetaEvent, surfaceKeyOf, surfaceOf } from "./meta-account.policy"
import { META_PROVIDER, metaEvent } from "./meta.data-types"
import { metaMessageTriggerOf, type MetaEventRow } from "./meta-message.trigger"
import { metaDerivedRowsOf, metaEventRowsOf } from "./meta.normalise.policy"

/** The language of the guest label a person Meta names not is kept under for the owner: the shop's owners read it in Vietnamese. */
const LOCALE = "vi"

@Injectable()
/**
 * Records signed Meta receipts and their outbox messages atomically. The receipt resolves the connection of every event (the Page or
 * Instagram account it belongs to) and writes each event of a connected surface once as a `meta.event` row of that account (its unique key
 * is the dedupe); a deferred consumer opens messaging windows, records the event, keeps the person and the message and queues downstream
 * handlers after the receipt has committed.
 */
export class MetaInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly receipts: MetaReceiptPolicy,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly connections: ConnectionsService,
        private readonly threads: MetaThreadsService,
        private readonly comments: MetaCommentsService,
        private readonly intake: AccountDataIntakeService,
        private readonly reads: AccountDataReadService,
        private readonly triggers: ProviderTriggersService,
        private readonly inboundEvents: InboundEventsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @Optional() @InjectLogger() private readonly logger?: Logger,
    ) {}

    /**
     * Records the signed receipt: each event of a connected surface becomes one `meta.event` row of its account with its typed handoff, in
     * one transaction, without processing business events. An event no live connection holds is dropped here.
     */
    accept(rawBody: RawDelivery, signature: DeliverySignature): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            if (signature === undefined) throw new MetaInboxError({ code: MetaInboxErrorCode.DeliveryInvalid })
            const events = this.eventsOf(rawBody)
            const owners = await this.ownersOf(events, manager)
            await eachInOrder(events, (event) => {
                const surface = surfaceOf(event)
                const owner = surface === null ? null : (owners.get(surfaceKeyOf(surface)) ?? null)
                return owner === null ? Promise.resolve() : this.receive(event, owner, manager)
            })
        })
    }

    /**
     * Records the delivery of a SANDBOX account (the sandbox door of the Meta webhook, whose route names the account and whose sandbox key
     * the door proved): every event of the body belongs to that account, whatever Page or Instagram id the body names (a sandbox account
     * holds none), and is written once as a `meta.event` row of it exactly as a signed live delivery is.
     */
    acceptSandbox(rawBody: RawDelivery, owner: MetaSurfaceOwner): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const events = this.eventsOf(rawBody)
            await eachInOrder(events, (event) => this.receive(event, owner, manager))
        })
    }

    /** The events of a receipt's raw body; a missing body, or one that is no JSON object, is an invalid delivery. */
    private eventsOf(rawBody: RawDelivery): Array<MetaEvent> {
        const read = parseJsonText(rawBody?.toString("utf8") ?? "")
        if (rawBody === undefined || !read.ok || !isRecord(read.value) || Array.isArray(read.value))
            throw new MetaInboxError({ code: MetaInboxErrorCode.DeliveryInvalid })
        return this.receipts.parse(read.value)
    }

    /**
     * Processes one pending event after commit for the row's own connection, keeps the person and the message it tells and completes the row;
     * the row lock and completion protect against replay, and a throw leaves the row pending for the queue's retry.
     */
    processRecordedDelivery(message: MetaDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const scoped = scopedDeliveryIdOf(message.deliveryId)
            if (scoped === null) return
            const pending = await this.intake.lockPending(
                manager,
                metaEvent.name,
                scoped.connectionId,
                scoped.externalId,
            )
            if (pending === null) return
            const event = pending.value.raw
            if (isMetaEvent(event)) {
                await this.processOwned(
                    event,
                    { id: pending.owner.connectionId, workspaceId: pending.owner.workspaceId },
                    manager,
                )
                await this.intake.write(manager, pending.owner.connectionId, metaDerivedRowsOf(event))
            }
            await this.intake.complete(manager, pending)
        })
    }

    /**
     * Delivers the event a claimed job carries to the chatbot front door; a payload that is not a queued Meta event is left
     * alone.
     */
    async deliverPayload(payload: object): Promise<void> {
        if (!isMetaInboundJob(payload)) return
        await this.deliver(payload)
    }

    /**
     * THE META ENTRY's delivery (the adapter stage of the one event pipeline, concept triggers rule 13): one queued event, as its stored
     * `meta.event` row holds it, through the provider's pure `translate` of its platform's message trigger, handed to the ONE delivery
     * function in one transaction. Only a direct message with words is a message: postbacks, comments, mentions and lead ads translate to
     * nothing and are left alone here (`not_a_message`). A message no registered graph takes stays kept raw and is kept for the owner. An
     * account removed between the receipt and this delivery delivers nothing and is logged (`account_removed`, R36: a removed account's
     * triggers stop; its kept raw row stays).
     */
    async deliver(job: MetaInboundJob): Promise<MetaDeliveryOutcome> {
        const row: MetaEventRow = { eventKey: job.event.event_key, raw: job.event }
        const declaration = metaMessageTriggerOf(row)
        const event = declaration.translate(row, { connectionId: job.connectionId })
        if (event === null) return "not_a_message"
        return this.entityManager.transaction(async (manager): Promise<MetaDeliveryOutcome> => {
            const connection = await this.connections.intakeOf(job.connectionId, META_PROVIDER, manager)
            if (connection.kind !== "ok") {
                this.logger?.warn(MetaInboxLogEvent.AccountRemoved, {
                    connectionId: job.connectionId,
                    eventKey: row.eventKey,
                    refusal: connection.kind,
                })
                return "account_removed"
            }
            const workspaceId = connection.value.workspaceId
            const stored = await this.reads.get(job.connectionId, metaEvent.name, row.eventKey, manager)
            const delivered = await this.triggers.deliver(
                {
                    workspaceId,
                    declaration,
                    connectionId: job.connectionId,
                    agentId: null,
                    events: [
                        {
                            event,
                            ...(stored === null ? {} : { raw: { type: metaEvent.name, id: stored.id } }),
                            ...(event.data.at === null ? {} : { occurredAt: event.data.at }),
                        },
                    ],
                },
                manager,
            )
            if (delivered.status === "off") return "switched_off"
            if (delivered.status === "disconnected") {
                this.logger?.warn(MetaInboxLogEvent.AccountRemoved, {
                    connectionId: job.connectionId,
                    eventKey: row.eventKey,
                    refusal: delivered.status,
                })
                return "account_removed"
            }
            if (delivered.status !== "delivered" || delivered.untaken === 0) return "delivered"
            await this.inboundEvents.keepUnrouted(manager, {
                workspaceId,
                channel: job.event.platform,
                sender: event.subject?.name ?? this.catalog.get(`conversations.${job.event.platform}Guest`, {}, LOCALE),
                body: event.data.text,
                eventId: `${event.data.messageKey}:${job.connectionId}`,
            })
            return "delivered"
        })
    }

    /** The live owner of every distinct surface of a delivery, each looked up once. */
    private async ownersOf(
        events: ReadonlyArray<MetaEvent>,
        manager: EntityManager,
    ): Promise<ReadonlyMap<string, OptionalMetaSurfaceOwner>> {
        const owners = new Map<string, OptionalMetaSurfaceOwner>()
        await eachInOrder(distinctSurfacesOf(events), async (surface) => {
            owners.set(
                surfaceKeyOf(surface),
                await this.connections.findLiveByMeta(META_PROVIDER, surface.key, surface.id, manager),
            )
        })
        return owners
    }

    /** Writes one event as a `meta.event` row of its account and queues its handoff when it is new. */
    private async receive(event: MetaEvent, owner: MetaSurfaceOwner, manager: EntityManager): Promise<void> {
        const written = await this.intake.write(manager, owner.id, metaEventRowsOf(event))
        const row = written.rows.find((entry) => entry.type === metaEvent.name)
        if (written.owner === null || row?.isNew !== true) return
        const deliveryId = `${owner.id}:${row.key}`
        const message: MetaDeliveryRecorded = { deliveryId }
        await this.outbox.write(manager, META_DELIVERY_QUEUE, message, {
            dedupeKey: `${META_DELIVERY_QUEUE}:${deliveryId}`,
        })
    }

    /** Opens the event's window, records it on its connection and queues it for the downstream handlers. */
    private async processOwned(event: MetaEvent, owner: MetaSurfaceOwner, manager: EntityManager): Promise<void> {
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
