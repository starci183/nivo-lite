import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "content_engagement_daily" })
/** One row of public.content_engagement_daily. */
export class ContentEngagementDailyEntity extends AbstractEntity {
    /** The workspace id. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The channel; the table checks it is facebook, zalo, instagram or tiktok, and callers hand it over as text. */
    @PrimaryColumn({ name: "channel", type: "text" })
    channel!: string

    /** The day. */
    @PrimaryColumn({ name: "day", type: "date" })
    day!: string

    /** The reach. */
    @Column({ name: "reach", type: "int", default: () => "0" })
    reach!: number

    /** The engagements. */
    @Column({ name: "engagements", type: "int", default: () => "0" })
    engagements!: number

    /** The messages. */
    @Column({ name: "messages", type: "int", default: () => "0" })
    messages!: number

    /** The synced at. */
    @Column({ name: "synced_at", type: "timestamptz", default: () => "now()" })
    syncedAt!: Date
}
