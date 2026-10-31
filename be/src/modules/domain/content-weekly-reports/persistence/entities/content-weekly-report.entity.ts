import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"
import type { WeeklyPost, WeeklySuggestion } from "../../content-weekly-reports.contracts"

@Entity({ schema: "public", name: "content_weekly_reports" })
/** One row of public.content_weekly_reports: the extras and the posting claim of one workspace week. */
export class ContentWeeklyReportEntity extends AbstractEntity {
    /** The workspace id. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The week, `YYYY-MM-DD`. */
    @PrimaryColumn({ name: "week_start", type: "date" })
    weekStart!: string

    /** The top posts. */
    @Column({ name: "posts", type: "jsonb", default: () => "'[]'::jsonb" })
    posts!: ReadonlyArray<WeeklyPost>

    /** How many posts were published. */
    @Column({ name: "post_count", type: "int", default: () => "0" })
    postCount!: number

    /** The suggestion, or null. */
    @Column({ name: "suggestion", type: "jsonb", nullable: true })
    suggestion!: WeeklySuggestion | null

    /** When the extras were computed. */
    @Column({ name: "computed_at", type: "timestamptz", nullable: true })
    computedAt!: Date | null

    /** When the card was posted. */
    @Column({ name: "posted_at", type: "timestamptz", nullable: true })
    postedAt!: Date | null
}
