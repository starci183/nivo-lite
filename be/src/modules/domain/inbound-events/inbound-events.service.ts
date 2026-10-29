import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InboundEventsError, InboundEventsErrorCode } from "./errors/inbound-events.error"
import { bankDedupeKey, eventDedupeKey } from "./inbound-dedupe.policy"
import type {
    BankPaymentEvent,
    BankPaymentRecorded,
    InboundInput,
    OrderHandoff,
    OptionalEventStatus,
    OptionalLeadRef,
    OptionalInboundEvent,
    UnroutedMessage,
} from "./inbound-events.contracts"
import { InboundEventEntity } from "./persistence/entities"

/** The columns a new inbound event is written with; every other column keeps its default. */
type NewInboundEvent = Pick<InboundEventEntity, "workspaceId" | "channel" | "kind" | "body" | "dedupeKey"> &
    Partial<
        Pick<InboundEventEntity, "senderName" | "senderContact" | "amountVnd" | "externalRef" | "eventId" | "leadId">
    >

/** Writes one inbound event once per workspace and dedupe key; answers its id, or undefined when the key was taken. */
const insertOnce = async (manager: EntityManager, event: NewInboundEvent): Promise<string | undefined> => {
    const result = await manager
        .createQueryBuilder(InboundEventEntity, "ie")
        .insert()
        .values(event)
        .orIgnore()
        .returning("id")
        .execute()
    return (result.raw as Array<{ id: string }>)[0]?.id
}

@Injectable()
/** The inbound events: the only writer of public.inbound_events. A credit is one event per workspace and provider transaction id. */
export class InboundEventsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
    ) {}

    /**
     * Records a bank credit as an inbound payment event in the caller's transaction. The provider's transaction id is the key: the
     * same credit sent again is counted on the first event and records nothing new.
     */
    async recordBankPayment(event: BankPaymentEvent): Promise<BankPaymentRecorded> {
        const key = bankDedupeKey(event.providerRef)
        const created = await insertOnce(event.manager, {
            workspaceId: event.workspaceId,
            channel: "bank",
            kind: "payment",
            senderName: event.sender,
            body: event.body,
            amountVnd: event.amountVnd,
            externalRef: event.externalRef,
            eventId: event.providerRef.trim(),
            dedupeKey: key,
        })
        if (created !== undefined) return { duplicate: false, inboundEventId: created }
        return this.countRepeat(event.manager, event.workspaceId, key)
    }

    /** Keeps a message nobody is bound to answer visible in the inbox; the same event twice is one row. It writes in the transaction of the caller that already claimed the delivery. */
    async keepUnrouted(manager: EntityManager, message: UnroutedMessage): Promise<void> {
        await insertOnce(manager, {
            workspaceId: message.workspaceId,
            channel: message.channel,
            kind: "message",
            senderName: message.sender,
            body: message.body,
            eventId: message.eventId,
            dedupeKey: `${message.channel}:message:${message.eventId}`,
        })
    }

    /** Holds an inbound event for the owner's check until an agent matches it; an event already past that stage is left as it is. */
    async holdForOwnerCheck(eventId: string, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.update(InboundEventEntity, { id: eventId, status: "received" }, { status: "needs_decision" })
    }

    /** The inbound event of the workspace, or null when there is none with that id. */
    async find(
        workspaceId: string,
        eventId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalInboundEvent> {
        const event = await manager.findOne(InboundEventEntity, { where: { workspaceId, id: eventId } })
        if (event === null) return null
        return {
            id: event.id,
            workspace_id: event.workspaceId,
            channel: event.channel,
            kind: event.kind,
            sender_name: event.senderName,
            sender_contact: event.senderContact,
            body: event.body,
            amount_vnd: event.amountVnd,
            external_ref: event.externalRef,
            event_id: event.eventId,
            lead_id: event.leadId,
            status: event.status,
        }
    }

    /** Sets where an event stands (null keeps it) and links the customer the engine found (null keeps it). */
    async mark(
        workspaceId: string,
        eventId: string,
        status: OptionalEventStatus,
        leadId: OptionalLeadRef,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        if (status === null && leadId === null) return
        await manager.update(
            InboundEventEntity,
            { workspaceId, id: eventId },
            { ...(status === null ? {} : { status }), ...(leadId === null ? {} : { leadId }) },
        )
    }

    /**
     * Records an input a channel delivered (a customer lead, say); the same event id twice is one input.
     * A claimed repeat reads the existing domain identity without repeating any writes.
     */
    recordInput(input: InboundInput): Promise<BankPaymentRecorded> {
        return this.entityManager.transaction((tx) => this.recordInputInTransaction(input, tx))
    }

    /** Records a durable input and its inbox receipt in the transaction already held by its consumer. */
    async recordInputInTransaction(input: InboundInput, manager: EntityManager): Promise<BankPaymentRecorded> {
        const key = `${input.workspaceId}:${eventDedupeKey(input.channel, input.kind, input.eventId)}`
        if (!(await this.inbox.claim(input.channel, key, manager))) {
            return this.findRepeatedInput(input, manager)
        }
        return this.writeInput(input, manager)
    }

    private async findRepeatedInput(input: InboundInput, manager: EntityManager): Promise<BankPaymentRecorded> {
        const key = eventDedupeKey(input.channel, input.kind, input.eventId)
        const recorded = await manager.findOne(InboundEventEntity, {
            select: { id: true },
            where: { workspaceId: input.workspaceId, dedupeKey: key },
        })
        if (recorded === null) throw new InboundEventsError({ code: InboundEventsErrorCode.Unreadable })
        return { duplicate: true, inboundEventId: recorded.id }
    }

    private async writeInput(input: InboundInput, manager: EntityManager): Promise<BankPaymentRecorded> {
        const key = eventDedupeKey(input.channel, input.kind, input.eventId)
        const created = await insertOnce(manager, {
            workspaceId: input.workspaceId,
            channel: input.channel,
            kind: input.kind,
            senderName: input.senderName,
            senderContact: input.senderContact,
            body: input.body,
            amountVnd: null,
            externalRef: input.externalRef,
            eventId: input.eventId.trim(),
            dedupeKey: key,
        })
        if (created !== undefined) return { duplicate: false, inboundEventId: created }
        return this.countRepeat(manager, input.workspaceId, key)
    }

    /** Counts a repeated delivery on the event it repeats; the first event must be readable. */
    private async countRepeat(manager: EntityManager, workspaceId: string, key: string): Promise<BankPaymentRecorded> {
        const result = await manager
            .createQueryBuilder(InboundEventEntity, "ie")
            .update()
            .set({ duplicateCount: () => "duplicate_count + 1", lastDuplicateAt: this.clock.now() })
            .where("workspace_id = :workspaceId AND dedupe_key = :key", { workspaceId, key })
            .returning("id")
            .execute()
        const repeated = (result.raw as Array<{ id: string }>)[0]
        if (repeated === undefined) throw new InboundEventsError({ code: InboundEventsErrorCode.Unreadable })
        return { duplicate: true, inboundEventId: repeated.id }
    }

    /** Hands a finished sale to the order chain, inside the caller's transaction; the same sale twice is one order. Answers whether it was new. */
    async handOffOrder(order: OrderHandoff, manager: EntityManager): Promise<boolean> {
        const created = await insertOnce(manager, {
            workspaceId: order.workspaceId,
            channel: "manual",
            kind: "order",
            senderName: order.sender,
            senderContact: order.contact,
            body: order.body,
            amountVnd: order.amountVnd,
            externalRef: order.ref,
            dedupeKey: `order:${order.ref}`,
            leadId: order.leadId,
        })
        return created !== undefined
    }
}
