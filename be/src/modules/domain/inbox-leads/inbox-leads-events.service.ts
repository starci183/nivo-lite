import { Injectable } from "@nestjs/common"
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { decisionsEntities } from "@modules/domain/decisions"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import { workItemsEntities } from "@modules/domain/work-items"
import { InjectPrimaryEntityManager } from "@modules/platform/database"

const [InboundEventEntity] = inboundEventsEntities
const [WorkItemEntity] = workItemsEntities
const [DecisionEntity] = decisionsEntities

/** A timestamp expression as UTC ISO text with milliseconds. */
const iso = (expression: string): string => `to_char(${expression} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

/** The most inputs, work items or decisions of one customer a journey reads. */
const JOURNEY_SIZE = 60

/** The most customers that are no lead yet a list reads. */
const STRAY_SIZE = 50

/** Narrows a read to one lead of one workspace; `alias` is the alias the query gave its table. */
const ofLead = <Row extends ObjectLiteral>(
    query: SelectQueryBuilder<Row>,
    alias: string,
    workspaceId: string,
    leadId: string,
): SelectQueryBuilder<Row> =>
    query
        .where(`${alias}.workspace_id = :workspaceId`, { workspaceId })
        .andWhere(`${alias}.lead_id = :leadId`, { leadId })

/** The newest rows first: ordered by a moment and then by id, cut at the size of a journey. */
const newestOf = <Row extends ObjectLiteral>(
    query: SelectQueryBuilder<Row>,
    at: string,
    id: string,
): SelectQueryBuilder<Row> => query.orderBy(at, "DESC").addOrderBy(id, "DESC").limit(JOURNEY_SIZE)

/** The inputs of one lead, grouped. */
export interface LeadEventGroup {
    /** The lead the inputs are linked to. */
    readonly lead_id: string
    /** How many inputs. */
    readonly event_count: number
    /** When the first one arrived, ISO 8601. */
    readonly first_at: string
    /** When the latest one arrived, ISO 8601. */
    readonly last_at: string
    /** The kind of the latest talk input (`lead` or `message`); empty when there is none. */
    readonly last_kind: string
    /** The words of the latest talk input; empty when there is none. */
    readonly last_body: string
    /** The channel of the latest input. */
    readonly last_channel: string
    /** A credit or payment input is linked to the lead: the money matched. */
    readonly has_payment: boolean
}

/** The inputs of one customer that is no lead yet, grouped by its customer key (or alone). */
export interface StrayEventGroup {
    /** `key:<customer key>` or `event:<event id>`. */
    readonly id: string
    /** The name of the sender; empty when the input has none. */
    readonly name: string
    /** How many inputs. */
    readonly event_count: number
    /** When the first one arrived, ISO 8601. */
    readonly first_at: string
    /** When the latest one arrived, ISO 8601. */
    readonly last_at: string
    /** The kind of the latest input. */
    readonly last_kind: string
    /** The words of the latest input. */
    readonly last_body: string
    /** The channel of the latest input. */
    readonly last_channel: string
    /** The money the inputs carry in VND, or null. */
    readonly amount_vnd: number | null
}

/** One input of the journey of a customer. */
export interface JourneyEvent {
    /** The input id. */
    readonly id: string
    /** The kind of input: message, lead, order, invoice or payment. */
    readonly kind: string
    /** The channel key. */
    readonly channel: string
    /** The words of the input. */
    readonly body: string
    /** The money it carries in VND, or null. */
    readonly amount_vnd: number | null
    /** Where it came from: page, campaign, device. */
    readonly source: Readonly<Record<string, string>>
    /** The name of the sender, or null. */
    readonly sender_name: string | null
    /** The phone or email of the sender, or null. */
    readonly sender_contact: string | null
    /** When it arrived, ISO 8601. */
    readonly created_at: string
}

/** One piece of work an agent did for a customer. */
export interface JourneyWork {
    /** The work item id. */
    readonly id: string
    /** The action key. */
    readonly action: string
    /** Where the work stands. */
    readonly status: string
    /** When it was done (or raised), ISO 8601. */
    readonly at: string
}

/** One decision made on a customer's work. */
export interface JourneyDecision {
    /** The decision id. */
    readonly id: string
    /** How it ended: auto_done, approved, edited or rejected. */
    readonly outcome: string
    /** The action key. */
    readonly action: string
    /** When it was made, ISO 8601. */
    readonly at: string
}

/** What the work of the agents says over a window. */
export interface WorkFigures {
    /** How many work items were raised. */
    readonly total: number
    /** How many of them the agents decided alone. */
    readonly auto: number
    /** The mean seconds from an input to the work finishing, or null when none finished. */
    readonly mean_seconds: number | null
}

/** Which customer a journey is read for: a lead by its id, or a stray by the key it grouped under. */
export type JourneySubject = { readonly leadId: string } | { readonly stray: string }

@Injectable()
/** The inbox's reads over the inbound inputs, the work items and the decisions of a workspace; it only reads, and it never leaves the workspace asked for. */
export class InboxLeadsEventsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The inputs grouped by the lead they were linked to. */
    groupsOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadEventGroup>> {
        if (leadIds.length === 0) return Promise.resolve([])
        const talk = "e.kind IN ('lead', 'message')"
        return this.entityManager
            .createQueryBuilder(InboundEventEntity, "e")
            .select("e.lead_id::text", "lead_id")
            .addSelect("count(*)::int", "event_count")
            .addSelect(iso("min(e.created_at)"), "first_at")
            .addSelect(iso("max(e.created_at)"), "last_at")
            .addSelect(
                `COALESCE((array_agg(e.kind ORDER BY e.created_at DESC) FILTER (WHERE ${talk}))[1], '')`,
                "last_kind",
            )
            .addSelect(
                `COALESCE((array_agg(e.body ORDER BY e.created_at DESC) FILTER (WHERE ${talk}))[1], '')`,
                "last_body",
            )
            .addSelect("(array_agg(e.channel ORDER BY e.created_at DESC))[1]", "last_channel")
            .addSelect("bool_or(e.kind = 'payment')", "has_payment")
            .where("e.workspace_id = :workspaceId", { workspaceId })
            .andWhere("e.lead_id IN (:...leadIds)", { leadIds })
            .groupBy("e.lead_id")
            .getRawMany<LeadEventGroup>()
    }

    /** The newest customers no lead was made for: grouped by customer key, or one by one when an input has none. */
    straysOf(workspaceId: string): Promise<Array<StrayEventGroup>> {
        return this.entityManager
            .createQueryBuilder(InboundEventEntity, "e")
            .select(
                "COALESCE('key:' || e.customer_key, 'event:' || (array_agg(e.id::text ORDER BY e.created_at DESC))[1])",
                "id",
            )
            .addSelect("COALESCE(max(e.sender_name), '')", "name")
            .addSelect("count(*)::int", "event_count")
            .addSelect(iso("min(e.created_at)"), "first_at")
            .addSelect(iso("max(e.created_at)"), "last_at")
            .addSelect("(array_agg(e.kind ORDER BY e.created_at DESC))[1]", "last_kind")
            .addSelect("(array_agg(e.body ORDER BY e.created_at DESC))[1]", "last_body")
            .addSelect("(array_agg(e.channel ORDER BY e.created_at DESC))[1]", "last_channel")
            .addSelect("sum(e.amount_vnd)::float8", "amount_vnd")
            .where("e.workspace_id = :workspaceId", { workspaceId })
            .andWhere("e.lead_id IS NULL")
            .groupBy("e.customer_key")
            .addGroupBy("CASE WHEN e.customer_key IS NULL THEN e.id END")
            .orderBy("max(e.created_at)", "DESC")
            .limit(STRAY_SIZE)
            .getRawMany<StrayEventGroup>()
    }

    /** How many work items of each lead wait for a decision. */
    async waitingOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, number>> {
        if (leadIds.length === 0) return new Map()
        const rows = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.lead_id::text", "lead_id")
            .addSelect("count(*)::int", "n")
            .where("w.workspace_id = :workspaceId", { workspaceId })
            .andWhere("w.status = 'waiting_decision'")
            .andWhere("w.lead_id IN (:...leadIds)", { leadIds })
            .groupBy("w.lead_id")
            .getRawMany<{ readonly lead_id: string; readonly n: number }>()
        return new Map(rows.map((row) => [row.lead_id, row.n]))
    }

    /** What the agents did alone and how fast they answered since `since`. */
    async weekOf(workspaceId: string, since: Date): Promise<WorkFigures> {
        const counts = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("count(*)::int", "total")
            .addSelect("(count(*) FILTER (WHERE w.decided_path = 'auto'))::int", "auto")
            .where("w.workspace_id = :workspaceId", { workspaceId })
            .andWhere("w.created_at >= :since", { since })
            .getRawOne<{ readonly total: number; readonly auto: number }>()
        const speed = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .innerJoin(InboundEventEntity, "e", "e.id = w.inbound_event_id")
            .select("avg(extract(epoch FROM (w.completed_at - e.created_at)))::float8", "mean_seconds")
            .where("w.workspace_id = :workspaceId", { workspaceId })
            .andWhere("w.status = 'done'")
            .andWhere("w.completed_at IS NOT NULL")
            .andWhere("w.created_at >= :since", { since })
            .getRawOne<{ readonly mean_seconds: number | null }>()
        return { total: counts?.total ?? 0, auto: counts?.auto ?? 0, mean_seconds: speed?.mean_seconds ?? null }
    }

    /** The inputs of one customer, newest first: a lead by its id, or a stray by the key it grouped under. */
    journeyOf(workspaceId: string, subject: JourneySubject): Promise<Array<JourneyEvent>> {
        const query = this.entityManager
            .createQueryBuilder(InboundEventEntity, "e")
            .select("e.id::text", "id")
            .addSelect("e.kind", "kind")
            .addSelect("e.channel", "channel")
            .addSelect("e.body", "body")
            .addSelect("e.amount_vnd::float8", "amount_vnd")
            .addSelect("e.source", "source")
            .addSelect("e.sender_name", "sender_name")
            .addSelect("e.sender_contact", "sender_contact")
            .addSelect(iso("e.created_at"), "created_at")
            .where("e.workspace_id = :workspaceId", { workspaceId })
        if ("leadId" in subject) query.andWhere("e.lead_id = :leadId", { leadId: subject.leadId })
        else if (subject.stray.startsWith("key:")) {
            query.andWhere("e.customer_key = :key AND e.lead_id IS NULL", { key: subject.stray.slice("key:".length) })
        } else
            query.andWhere("e.id = :eventId AND e.lead_id IS NULL", { eventId: subject.stray.slice("event:".length) })
        return query
            .orderBy("e.created_at", "DESC")
            .addOrderBy("e.id", "DESC")
            .limit(JOURNEY_SIZE)
            .getRawMany<JourneyEvent>()
    }

    /** The work agents did for one lead, newest first. */
    workOf(workspaceId: string, leadId: string): Promise<Array<JourneyWork>> {
        const query = this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id::text", "id")
            .addSelect("w.action", "action")
            .addSelect("w.status", "status")
            .addSelect(iso("COALESCE(w.completed_at, w.created_at)"), "at")
        return newestOf(
            ofLead(query, "w", workspaceId, leadId),
            "COALESCE(w.completed_at, w.created_at)",
            "w.id",
        ).getRawMany<JourneyWork>()
    }

    /** The decisions made on one lead, newest first. */
    decisionsOf(workspaceId: string, leadId: string): Promise<Array<JourneyDecision>> {
        const query = this.entityManager
            .createQueryBuilder(DecisionEntity, "d")
            .select("d.id::text", "id")
            .addSelect("d.outcome", "outcome")
            .addSelect("d.action", "action")
            .addSelect(iso("d.created_at"), "at")
        return newestOf(ofLead(query, "d", workspaceId, leadId), "d.created_at", "d.id").getRawMany<JourneyDecision>()
    }
}
