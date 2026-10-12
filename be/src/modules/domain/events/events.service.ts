import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EventEntry } from "./events.contracts"
import { INSERT_EVENT } from "./persistence/events.sql"

@Injectable()
/** The append-only evidence log: the only writer of public.events. */
export class EventsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Appends one line to the workspace's evidence log. */
    async record(entry: EventEntry): Promise<void> {
        await this.entityManager.query(INSERT_EVENT, [
            entry.workspaceId,
            entry.kind,
            entry.actor,
            entry.summary,
            entry.leadId ?? null,
            entry.workItemId ?? null,
            entry.evidence ?? null,
        ])
    }
}
