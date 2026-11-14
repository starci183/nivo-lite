import { Injectable } from "@nestjs/common"
import { In, Like, type EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox, type Inbox } from "@modules/platform/inbox"
import { InboundEventsError, InboundEventsErrorCode } from "./errors/inbound-events.error"
import { eventDedupeKey } from "./inbound-dedupe.policy"
import { returnedIdOf } from "./inbound-returned-id.policy"
import type {
    InboundEventDetail,
    InboundInput,
    InboundRecorded,
    OptionalEventStatus,
    OptionalLeadRef,
    OptionalInboundEvent,
    UnroutedMessage,
} from "./inbound-events.contracts"
import { InboundEventEntity } from "./persistence/entities"

/** The columns a new inbound event is written with; every other column keeps its default. */
type NewInboundEvent = Pick<InboundEventEntity, "workspaceId" | "channel" | "kind" | "body" | "dedupeKey"> &
    Partial<
        Pick<
            InboundEventEntity,
            "senderName" | "senderContact" | "amountVnd" | "externalRef" | "eventId" | "leadId" | "status" | "customerKey" | "source"
        >
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
    return returnedIdOf(result.raw)
}

/** A stored inbound event as the contract reads it. */
const toDetail = (event: InboundEventEntity): InboundEventDetail => ({
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
})

@Injectable()
/** The inbound events: the only writer of public.inbound_events. An input is one event per workspace and dedupe key. */
export class InboundEventsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
    ) {}

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

    /** Keeps a customer message that came too late for an agent to answer as an event the owner decides on; the same event twice is one row. It writes in the caller's transaction. */
    async keepForOwner(manager: EntityManager, message: UnroutedMessage): Promise<void> {
        await insertOnce(manager, {
            workspaceId: message.workspaceId,
            channel: message.channel,
            kind: "message",
            senderName: message.sender,
            body: message.body,
            eventId: message.eventId,
            dedupeKey: `${message.channel}:message:${message.eventId}`,
            status: "needs_decision",
        })
    }

    /**
     * Keeps one work item for an outage the owner must act on: `message.eventId` names the series (a connection), and a new item is written only
     * when the series has none open (`needs_decision`), so a failure that repeats is one item until the owner closes it or the outage ends.
     * Answers whether a new item was written. It writes in the caller's transaction.
     */
    async keepOutageForOwner(manager: EntityManager, message: UnroutedMessage): Promise<boolean> {
        const open = await manager.findOne(InboundEventEntity, {
            select: { id: true },
            where: {
                workspaceId: message.workspaceId,
                channel: message.channel,
                kind: "message",
                status: "needs_decision",
                eventId: Like(`${message.eventId}:%`),
            },
        })
        if (open !== null) return false
        const outage = `${message.eventId}:${this.clock.now().getTime()}`
        const created = await insertOnce(manager, {
            workspaceId: message.workspaceId,
            channel: message.channel,
            kind: "message",
            senderName: message.sender,
            body: message.body,
            eventId: outage,
            dedupeKey: `${message.channel}:message:${outage}`,
            status: "needs_decision",
        })
        return created !== undefined
    }

    /** Closes the open work item of an outage series, because the outage is over; a series with none open changes nothing. */
    async closeOutage(workspaceId: string, channel: string, series: string): Promise<void> {
        await this.entityManager.update(
            InboundEventEntity,
            { workspaceId, channel, kind: "message", status: "needs_decision", eventId: Like(`${series}:%`) },
            { status: "processed" },
        )
    }

    /** The inbound event of the workspace, or null when there is none with that id. */
    async find(
        workspaceId: string,
        eventId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalInboundEvent> {
        const event = await manager.findOne(InboundEventEntity, { where: { workspaceId, id: eventId } })
        return event === null ? null : toDetail(event)
    }

    /** The given inbound events of the workspace (a missing event is missing from the answer). */
    async findMany(workspaceId: string, eventIds: ReadonlyArray<string>): Promise<Array<InboundEventDetail>> {
        const wanted = [...new Set(eventIds)]
        if (wanted.length === 0) return []
        const where = { workspaceId, id: In(wanted) }
        const events = await this.entityManager.find(InboundEventEntity, { where, take: wanted.length })
        return events.map((item) => toDetail(item))
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
    recordInput(input: InboundInput): Promise<InboundRecorded> {
        return this.entityManager.transaction((tx) => this.recordInputInTransaction(input, tx))
    }

    /** Records a durable input and its inbox receipt in the transaction already held by its consumer. */
    async recordInputInTransaction(input: InboundInput, manager: EntityManager): Promise<InboundRecorded> {
        const key = `${input.workspaceId}:${eventDedupeKey(input.channel, input.kind, input.eventId)}`
        if (!(await this.inbox.claim(input.channel, key, manager))) {
            return this.findRepeatedInput(input, manager)
        }
        return this.writeInput(input, manager)
    }

    private async findRepeatedInput(input: InboundInput, manager: EntityManager): Promise<InboundRecorded> {
        const key = eventDedupeKey(input.channel, input.kind, input.eventId)
        const recorded = await manager.findOne(InboundEventEntity, {
            select: { id: true },
            where: { workspaceId: input.workspaceId, dedupeKey: key },
        })
        if (recorded === null) throw new InboundEventsError({ code: InboundEventsErrorCode.Unreadable })
        return { duplicate: true, inboundEventId: recorded.id }
    }

    private async writeInput(input: InboundInput, manager: EntityManager): Promise<InboundRecorded> {
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
            customerKey: input.customerKey ?? null,
            source: input.source ?? {},
        })
        if (created !== undefined) return { duplicate: false, inboundEventId: created }
        return this.countRepeat(manager, input.workspaceId, key)
    }

    /** Counts a repeated delivery on the event it repeats; the first event must be readable. */
    private async countRepeat(manager: EntityManager, workspaceId: string, key: string): Promise<InboundRecorded> {
        const result = await manager
            .createQueryBuilder(InboundEventEntity, "ie")
            .update()
            .set({ duplicateCount: () => "duplicate_count + 1", lastDuplicateAt: this.clock.now() })
            .where("workspace_id = :workspaceId AND dedupe_key = :key", { workspaceId, key })
            .returning("id")
            .execute()
        const repeatedId = returnedIdOf(result.raw)
        if (repeatedId === undefined) throw new InboundEventsError({ code: InboundEventsErrorCode.Unreadable })
        return { duplicate: true, inboundEventId: repeatedId }
    }
}
