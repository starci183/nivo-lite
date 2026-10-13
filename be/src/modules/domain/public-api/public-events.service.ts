import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApiKeysService } from "@modules/domain/api-keys"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PublicApiError } from "./errors/public-api.error"
import type { EventListItem, EventsPage, ListEventsParams } from "./public-api.contracts"
import { clampLimit, eventsSince } from "./public-api.policy"
import type { EventsRow } from "./persistence/public-api.rows"
import { LIST_EVENTS } from "./persistence/public-api.sql"

/** Events listed by default and at most. */
const EVENTS_LIMIT_DEFAULT = 100
const EVENTS_LIMIT_MAX = 500

type EventRow = Pick<EventsRow, "id" | "kind" | "actor" | "summary" | "evidence" | "lead_id" | "created_at">

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
        const rows = await this.entityManager.query<Array<EventRow>>(LIST_EVENTS, [who.workspaceId, from.value, limit])
        const events = rows.map(toEventItem)
        return { events, nextSince: events.at(-1)?.createdAt ?? from.value }
    }
}
