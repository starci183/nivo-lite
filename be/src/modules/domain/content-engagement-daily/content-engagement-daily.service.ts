import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EngagementDayRecord, MessagesDay, ReportedDay } from "./content-engagement-daily.contracts"
import {
    LIST_ENGAGEMENT_DAYS,
    UPSERT_ENGAGEMENT_DAYS,
    UPSERT_MESSAGE_DAYS,
} from "./persistence/content-engagement-daily.sql"

@Injectable()
/** The `content_engagement_daily` rows: the daily reach and engagement of each social channel of a workspace. */
export class ContentEngagementDailyService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Upserts the days a provider reported for one channel in one statement; answers how many days were given. */
    async upsert(workspaceId: string, channel: string, days: ReadonlyArray<ReportedDay>): Promise<number> {
        if (days.length === 0) return 0
        await this.entityManager.query(UPSERT_ENGAGEMENT_DAYS, [workspaceId, channel, JSON.stringify(days)])
        return days.length
    }

    /** Upserts the new customer messages of channel days in one statement; answers how many days were given. */
    async upsertMessages(workspaceId: string, days: ReadonlyArray<MessagesDay>): Promise<number> {
        if (days.length === 0) return 0
        await this.entityManager.query(UPSERT_MESSAGE_DAYS, [workspaceId, JSON.stringify(days)])
        return days.length
    }

    /** The daily rows from `from` (inclusive) to `to` (exclusive), oldest first. */
    between(workspaceId: string, from: string, to: string): Promise<ReadonlyArray<EngagementDayRecord>> {
        return this.entityManager.query<Array<EngagementDayRecord>>(LIST_ENGAGEMENT_DAYS, [workspaceId, from, to])
    }
}
