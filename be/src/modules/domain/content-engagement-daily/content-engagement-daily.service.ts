import { Injectable } from "@nestjs/common"
import { And, LessThan, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EngagementDayRecord, MessagesDay, ReportedDay } from "./content-engagement-daily.contracts"
import { ContentEngagementDailyEntity } from "./persistence/entities"

@Injectable()
/** The `content_engagement_daily` rows: the daily reach and engagement of each social channel of a workspace. */
export class ContentEngagementDailyService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Upserts the days a provider reported for one channel in one statement; answers how many days were given. */
    async upsert(workspaceId: string, channel: string, days: ReadonlyArray<ReportedDay>): Promise<number> {
        if (days.length === 0) return 0
        await this.entityManager.upsert(
            ContentEngagementDailyEntity,
            days.map((day) => ({
                workspaceId,
                channel,
                day: day.day,
                reach: day.reach,
                engagements: day.engagements,
                syncedAt: () => "now()",
            })),
            ["workspaceId", "channel", "day"],
        )
        return days.length
    }

    /** Upserts the new customer messages of channel days in one statement; answers how many days were given. */
    async upsertMessages(workspaceId: string, days: ReadonlyArray<MessagesDay>): Promise<number> {
        if (days.length === 0) return 0
        await this.entityManager.upsert(
            ContentEngagementDailyEntity,
            days.map((day) => ({
                workspaceId,
                channel: day.channel,
                day: day.day,
                messages: day.messages,
                syncedAt: () => "now()",
            })),
            ["workspaceId", "channel", "day"],
        )
        return days.length
    }

    /** The daily rows from `from` (inclusive) to `to` (exclusive), oldest first. */
    async between(workspaceId: string, from: string, to: string): Promise<ReadonlyArray<EngagementDayRecord>> {
        const rows = await this.entityManager.find(ContentEngagementDailyEntity, {
            where: { workspaceId, day: And(MoreThanOrEqual(from), LessThan(to)) },
            order: { day: "ASC", channel: "ASC" },
            take: 400,
        })
        return rows.map((row) => ({
            channel: row.channel,
            day: row.day,
            reach: row.reach,
            engagements: row.engagements,
            messages: row.messages,
        }))
    }
}
