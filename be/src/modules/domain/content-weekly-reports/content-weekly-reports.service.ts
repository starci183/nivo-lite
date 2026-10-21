import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalStoredWeeklyReport, WeeklyExtras } from "./content-weekly-reports.contracts"
import type { ClaimedWeekRow, WeeklyReportRow } from "./persistence/content-weekly-reports.rows"
import { CLAIM_WEEKLY_POST, FIND_WEEKLY_REPORT, UPSERT_WEEKLY_EXTRAS } from "./persistence/content-weekly-reports.sql"

@Injectable()
/**
 * The `content_weekly_reports` rows: per workspace and week, the top posts and the suggestion the marketing report computed (so a
 * report read does not call the channels and the model again) and when the weekly card was posted (so it is posted once).
 */
export class ContentWeeklyReportsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The stored week, or null when nothing was stored for it. */
    async find(workspaceId: string, weekStart: string): Promise<OptionalStoredWeeklyReport> {
        const [row] = await this.entityManager.query<Array<WeeklyReportRow>>(FIND_WEEKLY_REPORT, [
            workspaceId,
            weekStart,
        ])
        if (row === undefined) return null
        return {
            posts: row.posts,
            postCount: row.post_count,
            suggestion: row.suggestion,
            computedAt: row.computed_at,
            postedAt: row.posted_at,
        }
    }

    /** Stores the extras computed at `at` for a week, keeping when its card was posted. */
    async store(workspaceId: string, weekStart: string, extras: WeeklyExtras, at: string): Promise<void> {
        await this.entityManager.query(UPSERT_WEEKLY_EXTRAS, [
            workspaceId,
            weekStart,
            JSON.stringify(extras.posts),
            extras.postCount,
            extras.suggestion === null ? null : JSON.stringify(extras.suggestion),
            at,
        ])
    }

    /** Claims the posting of the week's card; true only for the one call that claimed it. */
    async claimPost(workspaceId: string, weekStart: string, at: string): Promise<boolean> {
        const rows = await this.entityManager.query<Array<ClaimedWeekRow>>(CLAIM_WEEKLY_POST, [
            workspaceId,
            weekStart,
            at,
        ])
        return rows.length > 0
    }
}
