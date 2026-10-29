import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApiKeysService } from "@modules/domain/api-keys"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PublicApiError } from "./errors/public-api.error"
import type { EventListItem, EventsPage, ListEventsParams } from "./public-api.contracts"
import { clampLimit, eventsSince } from "./public-api.policy"

/** Events listed by default and at most. */
const EVENTS_LIMIT_DEFAULT = 100
const EVENTS_LIMIT_MAX = 500

/** One public.events row as the select shapes it. */
interface EventRow {
    /** The event id. */
    readonly id: string
    /** The event kind, e.g. api.lead. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** One line telling what happened. */
    readonly summary: string
    /** The evidence clipped by the select, or null. */
    readonly evidence: string | null
    /** The customer it is about, or null. */
    readonly lead_id: string | null
    /** When it happened, ISO 8601 as the select formats it. */
    readonly created_at: string
}

const toEventItem = (row: EventRow): EventListItem => ({
    id: row.id,
    kind: row.kind,
    actor: row.actor,
    summary: row.summary,
    evidence: row.evidence,
    leadId: row.lead_id,
    createdAt: row.created_at,
})

@Injectable()
/** The evidence log the public API pulls for the workspace of a key, reached only through the shared primary EntityManager. */
export class PublicEventsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly keys: ApiKeysService,
    ) {}

    /** The evidence lines of the key's workspace after `since` (one day back when absent), oldest first, with the cursor for the next call. */
    async listEvents(params: ListEventsParams): Promise<EventsPage> {
        const who = await this.keys.authenticate("events:read", params.authorization)
        const from = eventsSince(params.since, this.clock.now())
        if (from.kind === "refused") throw new PublicApiError({ code: from.code })
        const limit = clampLimit(params.limit, EVENTS_LIMIT_DEFAULT, EVENTS_LIMIT_MAX)
        const rows = await this.entityManager
            .createQueryBuilder()
            .select("e.id", "id")
            .addSelect("e.kind", "kind")
            .addSelect("e.actor", "actor")
            .addSelect("e.summary", "summary")
            .addSelect("left(e.evidence, 500)", "evidence")
            .addSelect("e.lead_id", "lead_id")
            .addSelect("to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')", "created_at")
            .from("public.events", "e")
            .where("e.workspace_id = :workspaceId AND e.created_at > :since", {
                workspaceId: who.workspaceId,
                since: from.value,
            })
            .orderBy("e.created_at", "ASC")
            .limit(limit)
            .getRawMany<EventRow>()
        const events = rows.map(toEventItem)
        return { events, nextSince: events.at(-1)?.createdAt ?? from.value }
    }
}
