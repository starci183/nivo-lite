import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InboundEventsError, InboundEventsErrorCode } from "./errors/inbound-events.error"
import { bankDedupeKey, eventDedupeKey } from "./inbound-dedupe.policy"
import type {
    BankPaymentEvent,
    BankPaymentRecorded,
    InboundInput,
    OptionalEventStatus,
    OptionalLeadRef,
    OptionalInboundEvent,
    UnroutedMessage,
} from "./inbound-events.contracts"
import type { EventIdRow, InboundEventRow } from "./persistence/inbound-events.rows"
import {
    BUMP_DUPLICATE_EVENT,
    FIND_INBOUND_EVENT,
    HOLD_EVENT_FOR_OWNER,
    INSERT_BANK_EVENT,
    INSERT_INPUT_EVENT,
    INSERT_UNROUTED_EVENT,
    MARK_INBOUND_EVENT,
} from "./persistence/inbound-events.sql"

@Injectable()
/** The inbound events: the only writer of public.inbound_events. A credit is one event per workspace and provider transaction id. */
export class InboundEventsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /**
     * Records a bank credit as an inbound payment event in the caller's transaction. The provider's transaction id is the key: the
     * same credit sent again is counted on the first event and records nothing new.
     */
    async recordBankPayment(event: BankPaymentEvent): Promise<BankPaymentRecorded> {
        const key = bankDedupeKey(event.providerRef)
        const [created] = await event.manager.query<Array<EventIdRow>>(INSERT_BANK_EVENT, [
            event.workspaceId,
            event.origin,
            event.sender,
            event.body,
            event.amountVnd,
            event.externalRef,
            event.providerRef.trim(),
            key,
        ])
        if (created !== undefined) return { duplicate: false, inboundEventId: created.id }
        const [repeated] = await event.manager.query<Array<EventIdRow>>(BUMP_DUPLICATE_EVENT, [
            event.workspaceId,
            key,
            this.clock.now(),
        ])
        if (repeated === undefined) throw new InboundEventsError({ code: InboundEventsErrorCode.Unreadable })
        return { duplicate: true, inboundEventId: repeated.id }
    }

    /** Keeps a message nobody is bound to answer visible in the inbox; the same event twice is one row. It writes in the transaction of the caller that already claimed the delivery. */
    async keepUnrouted(manager: EntityManager, message: UnroutedMessage): Promise<void> {
        await manager.query(INSERT_UNROUTED_EVENT, [
            message.workspaceId,
            message.channel,
            message.sender,
            message.body,
            message.eventId,
            `${message.channel}:message:${message.eventId}`,
        ])
    }

    /** Holds an inbound event for the owner's check until an agent matches it; an event already past that stage is left as it is. */
    async holdForOwnerCheck(eventId: string): Promise<void> {
        await this.entityManager.query(HOLD_EVENT_FOR_OWNER, [eventId])
    }

    /** The inbound event of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, eventId: string): Promise<OptionalInboundEvent> {
        const rows = await this.entityManager.query<Array<InboundEventRow>>(FIND_INBOUND_EVENT, [workspaceId, eventId])
        return rows[0] ?? null
    }

    /** Sets where an event stands (null keeps it) and links the customer the engine found (null keeps it). */
    async mark(
        workspaceId: string,
        eventId: string,
        status: OptionalEventStatus,
        leadId: OptionalLeadRef,
    ): Promise<void> {
        await this.entityManager.query(MARK_INBOUND_EVENT, [workspaceId, eventId, status, leadId])
    }

    /** Records an input a channel delivered (a customer lead, say); the same event id twice is one input and counts as a repeat. */
    async recordInput(input: InboundInput): Promise<BankPaymentRecorded> {
        const key = eventDedupeKey(input.channel, input.kind, input.eventId)
        const [created] = await this.entityManager.query<Array<EventIdRow>>(INSERT_INPUT_EVENT, [
            input.workspaceId,
            input.channel,
            input.kind,
            input.origin,
            input.senderName,
            input.senderContact,
            input.body,
            null,
            input.externalRef,
            input.eventId.trim(),
            key,
        ])
        if (created !== undefined) return { duplicate: false, inboundEventId: created.id }
        const [repeated] = await this.entityManager.query<Array<EventIdRow>>(BUMP_DUPLICATE_EVENT, [
            input.workspaceId,
            key,
            this.clock.now(),
        ])
        return { duplicate: true, inboundEventId: repeated?.id ?? "" }
    }
}
