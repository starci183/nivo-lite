import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalStoredWeeklyReport, WeeklyExtras } from "./content-weekly-reports.contracts"
import { ContentWeeklyReportEntity } from "./persistence/entities"

/** The ISO text of a timestamp the way `to_json(x) #>> '{}'` writes it, the shape the contract always carried. */
const isoText = (column: string): string => `to_json(r.${column}) #>> '{}'`

/** One stored week as the query answers it: the instants are ISO text, or null. */
interface WeeklyReportRow {
    /** The top posts. */
    readonly posts: ContentWeeklyReportEntity["posts"]
    /** How many posts were published. */
    readonly postCount: number
    /** The suggestion, or null. */
    readonly suggestion: ContentWeeklyReportEntity["suggestion"]
    /** When the extras were computed, ISO text, or null. */
    readonly computedAt: string | null
    /** When the card was posted, ISO text, or null. */
    readonly postedAt: string | null
}

const isWeeklyReportRow = (value: unknown): value is WeeklyReportRow =>
    typeof value === "object" &&
    value !== null &&
    "posts" in value &&
    Array.isArray(value.posts) &&
    "postCount" in value &&
    typeof value.postCount === "number"

@Injectable()
/**
 * The `content_weekly_reports` rows: per workspace and week, the top posts and the suggestion the marketing report computed (so a
 * report read does not call the channels and the model again) and when the weekly card was posted (so it is posted once).
 */
export class ContentWeeklyReportsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The stored week, or null when nothing was stored for it. */
    async find(workspaceId: string, weekStart: string): Promise<OptionalStoredWeeklyReport> {
        const rows: ReadonlyArray<unknown> = await this.entityManager
            .createQueryBuilder(ContentWeeklyReportEntity, "r")
            .select("r.posts", "posts")
            .addSelect("r.post_count", "postCount")
            .addSelect("r.suggestion", "suggestion")
            .addSelect(isoText("computed_at"), "computedAt")
            .addSelect(isoText("posted_at"), "postedAt")
            .where("r.workspaceId = :workspaceId AND r.weekStart = :weekStart", { workspaceId, weekStart })
            .limit(1)
            .getRawMany()
        const row = rows.find(isWeeklyReportRow)
        if (row === undefined) return null
        return {
            posts: row.posts,
            postCount: row.postCount,
            suggestion: row.suggestion,
            computedAt: row.computedAt,
            postedAt: row.postedAt,
        }
    }

    /** Stores the extras computed at `at` for a week, keeping when its card was posted. */
    async store(workspaceId: string, weekStart: string, extras: WeeklyExtras, at: string): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ContentWeeklyReportEntity, "cwr")
            .insert()
            .values({
                workspaceId,
                weekStart,
                posts: () => ":posts::jsonb",
                postCount: extras.postCount,
                suggestion: () => ":suggestion::jsonb",
                computedAt: () => ":computedAt::timestamptz",
            })
            .setParameter("posts", JSON.stringify(extras.posts))
            .setParameter("suggestion", extras.suggestion === null ? null : JSON.stringify(extras.suggestion))
            .setParameter("computedAt", at)
            .orUpdate(["posts", "post_count", "suggestion", "computed_at"], ["workspace_id", "week_start"])
            .execute()
    }

    /** Claims the posting of the week's card; true only for the one call that claimed it. */
    async claimPost(workspaceId: string, weekStart: string, at: string): Promise<boolean> {
        const claimed = await this.entityManager
            .createQueryBuilder(ContentWeeklyReportEntity, "content_weekly_reports")
            .insert()
            .values({ workspaceId, weekStart, postedAt: () => ":postedAt::timestamptz" })
            .setParameter("postedAt", at)
            .orUpdate(["posted_at"], ["workspace_id", "week_start"], {
                overwriteCondition: { where: "content_weekly_reports.posted_at IS NULL" },
            })
            .returning("to_char(week_start, 'YYYY-MM-DD') AS \"weekStart\"")
            .execute()
        return Array.isArray(claimed.raw) && claimed.raw.length > 0
    }
}
