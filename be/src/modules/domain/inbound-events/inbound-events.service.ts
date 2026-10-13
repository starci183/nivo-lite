import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InboundEventsError, InboundEventsErrorCode } from "./errors/inbound-events.error"
import { bankDedupeKey } from "./inbound-dedupe.policy"
import type { BankPaymentEvent, BankPaymentRecorded, OrderHandoff, UnroutedMessage } from "./inbound-events.contracts"
import type { EventIdRow } from "./persistence/inbound-events.rows"
import {
    BUMP_DUPLICATE_EVENT,
    INSERT_ORDER_HANDOFF,
    HOLD_EVENT_FOR_OWNER,
    INSERT_BANK_EVENT,
    INSERT_UNROUTED_EVENT,
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

    /** Hands a finished sale to the order chain, inside the caller's transaction; the same sale twice is one order. Answers whether it was new. */
    async handOffOrder(order: OrderHandoff, manager: EntityManager): Promise<boolean> {
        const rows = await manager.query<Array<{ id: string }>>(INSERT_ORDER_HANDOFF, [
            order.workspaceId,
            order.origin,
            order.sender,
            order.contact,
            order.body,
            order.amountVnd,
            order.ref,
            order.leadId,
        ])
        return rows.length > 0
    }
}
