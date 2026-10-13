import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EventEntry, EventLine } from "./events.contracts"
import { INSERT_EVENT, LIST_LEAD_EVENTS } from "./persistence/events.sql"

@Injectable()
/** The append-only evidence log: the only writer of public.events. */
export class EventsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Appends one line to the workspace's evidence log, inside the caller's transaction when it hands one. */
    async record(entry: EventEntry, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.query(INSERT_EVENT, [
            entry.workspaceId,
            entry.kind,
            entry.actor,
            entry.summary,
            entry.leadId ?? null,
            entry.workItemId ?? null,
            entry.evidence ?? null,
        ])
    }

    /** The first lines of a customer's history, oldest first. */
    leadHistory(workspaceId: string, leadId: string, limit: number): Promise<Array<EventLine>> {
        return this.entityManager.query<Array<EventLine>>(LIST_LEAD_EVENTS, [workspaceId, leadId, limit])
    }
}
